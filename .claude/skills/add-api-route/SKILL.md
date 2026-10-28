---
name: add-api-route
description: Add, change or remove an Express route in apps/api — one file per route, a .strict() Zod schema from packages/contracts, the route's place in its module's ROUTES array, and its OperationSpec in the module's *.docs.ts so the OpenAPI test passes. Use for any change that mounts, alters or removes an API endpoint.
---

# Add or change an API route

Read `AGENTS.md` §4 (invariants), §4a (the API reference) and §4b (routes, one
per file) first. Then copy the shape of an existing module — `apps/api/src/modules/team/`
is small and complete.

## 1. The contract

Request and response shapes live in `packages/contracts/src`, never in the API.

- Input schemas are `.strict()`. An unknown field must be a 400 that names it.
- A dealer-facing input never accepts `dealerId` — it comes from the session.
- Money is `BigInt` paise.
- A new params/query/body schema's export name goes in `INPUT_SCHEMA_NAMES` in
  `apps/api/src/docs/schemas.ts`.
- Rebuild contracts for the apps to see it:
  `pnpm --filter @dealers-drive/contracts build`.

## 2. The route file

One file per route in `apps/api/src/modules/<module>/routes/`, named for the
verb and the path it answers (`patch-team-member.ts`), exporting one registrar:

```ts
export const patchTeamMember: TeamRoute = (router, service) => {
  router.patch(
    '/team/members/:id',
    requirePermission('member:manage'),
    validate({ params: IdParam, body: UpdateMemberInput }),
    handle((req) =>
      service.updateMember(
        actorOf(req),
        validated<IdParam>(req, 'params').id,
        validated<UpdateMemberInput>(req, 'body'),
      ),
    ),
  );
};
```

- Import it in `<module>.routes.ts` and add it to `ROUTES` **at the position it
  should match** — Express matches in array order, so `/team/:id` before
  `/team/invitations` is a bug.
- Business logic goes in the service; the route only validates, authorises
  and delegates.
- A listing's status changes only through `transition(…)` in
  `modules/listings/listing.state.ts`.
- A cross-request counter or rate limit uses the `CachePort`, never a `Map`.
- Error sentences go in `<module>.messages.ts` (or `platform/messages.ts` when
  two modules say it).

A whole new module also needs: its router mounted in the app, `<module>.docs.ts`
listed in `MODULES` in `apps/api/src/docs/openapi.ts`, and its tag in
`DOC_TAGS` and `TAG_ORDER` in `apps/api/src/docs/tags.ts`.

## 3. The OpenAPI operation — same PR

Add an `OperationSpec` to the module's `*.docs.ts`: `method`, the full `path`
(`/v1/dealer/team/members/{id}`), a unique `operationId`, `tag`, `summary`,
`description`, `audience`, `permission` if any, `responses` naming a contracts
schema by export name, and `errors` as status codes.

Do **not** hand-write a schema, a parameter list or an error body — they are
generated from contracts, the route's validator and `src/docs/errors.ts`.

Removing a route means removing its operation too: the test fails in both
directions.

## 4. Tests

- Unit: `apps/api/tests/unit/modules/<module>/`.
- Integration (real Postgres, real router): `apps/api/tests/<feature>.test.ts`,
  using the kits beside them (`auth-harness.ts`, `listings-kit.ts`, …).
- Cover the refusals as well as the success: 400 on an unknown field, 401/403,
  404 for another dealership's row, 409 for an invalid transition.
- `apps/api/tests/unit/docs/openapi.test.ts` must stay green.

## 5. Document and verify

- Reasoning goes in `docs/code/api/modules/<module>.md` under a `###` heading
  naming the declaration — never as a comment (`write-code-notes`).
- Run `verify-change`, then open `/api/docs` locally and read the operation.

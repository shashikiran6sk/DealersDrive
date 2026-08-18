import type { NextFunction, Request, RequestHandler, Response, Router } from 'express';

/**
 * Reads an Express router's own stack, so a route file can be tested for what
 * it *wires* rather than for what it answers.
 *
 * The integration suite already proves the endpoints work end to end. What it
 * cannot prove cheaply is the negative: that no route is missing its guard.
 * A handler that reads `dealerPrincipal(req)` correctly is still a data leak if
 * `requirePermission` was left off the chain, and that mistake looks like
 * nothing in a diff.
 *
 * Rather than match middleware by function identity — which breaks the moment
 * anything is wrapped — `permissionsOn` *runs* each handler against a
 * principal holding no permissions and reads the permission name out of the
 * ForbiddenError it raises. That works because `requirePermission` names the
 * permission it wanted, which is also why its error message is useful to a
 * developer in the first place.
 *
 * The terminal handler is run too and throws — `dealerPrincipal()` refuses a
 * request that never went through a guard, which is exactly the behaviour
 * `auth.test.ts` asserts. Here it is noise, so every invocation is wrapped:
 * this file is reading the chain, not exercising it.
 */

/** Runs one handler for its side effect on `next`, ignoring anything it throws. */
function probe(handler: RequestHandler, req: Request, next: NextFunction): void {
  try {
    handler(req, {} as Response, next);
  } catch {
    // A terminal handler refusing to run without a principal. Not our concern.
  }
}

interface Layer {
  name: string;
  handle: RequestHandler;
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: RequestHandler; name: string }[];
  };
}

export interface ProbedRoute {
  method: string;
  path: string;
  handlers: RequestHandler[];
}

/** Every route the router declares, in declaration order. */
export function routesOf(router: Router): ProbedRoute[] {
  const stack = (router as unknown as { stack: Layer[] }).stack;

  return stack.flatMap((layer) => {
    if (!layer.route) return [];
    const { path, methods, stack: handlers } = layer.route;

    return Object.keys(methods)
      .filter((method) => methods[method])
      .map((method) => ({
        method: method.toUpperCase(),
        path,
        handlers: handlers.map((entry) => entry.handle),
      }));
  });
}

/** `GET /vehicles`, `POST /vehicles/:id/submit`, … for a whole router. */
export function signaturesOf(router: Router): string[] {
  return routesOf(router).map((route) => `${route.method} ${route.path}`);
}

export function routeFor(router: Router, signature: string): ProbedRoute | undefined {
  return routesOf(router).find((route) => `${route.method} ${route.path}` === signature);
}

/**
 * The permissions a route's chain demands, discovered by running each handler
 * against a principal that holds none and reading what it asks for.
 */
export function permissionsOn(route: ProbedRoute): string[] {
  const found: string[] = [];

  for (const handler of route.handlers) {
    const req = {
      principal: { kind: 'DEALER', permissions: [] as string[], dealerStatus: 'ACTIVE' },
      body: {},
      query: {},
      params: {},
    } as unknown as Request;

    probe(handler, req, ((error?: unknown) => {
      const detail = (error as { detail?: string } | undefined)?.detail ?? '';
      const match = /needs the ([\w:]+) permission/.exec(detail);
      if (match?.[1]) found.push(match[1]);
    }) as NextFunction);
  }

  return found;
}

/** True when the chain refuses a dealer whose dealership is not yet ACTIVE. */
export function requiresActiveDealer(route: ProbedRoute): boolean {
  return route.handlers.some((handler) => {
    let code: string | undefined;

    probe(
      handler,
      {
        principal: { kind: 'DEALER', permissions: ['*'], dealerStatus: 'PENDING' },
        body: {},
        query: {},
        params: {},
      } as unknown as Request,
      ((error?: unknown) => {
        code = (error as { code?: string } | undefined)?.code;
      }) as NextFunction,
    );

    return code === 'DEALER_NOT_ACTIVE';
  });
}

const A_UUID = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

/**
 * The path's own `:params`, filled with a uuid. `validate()` stores nothing at
 * all when *any* source fails, so probing with empty params would hide the
 * fact that a route also validates its body — the params failure would be the
 * only thing visible. Giving the params a plausible value lets the other
 * sources report themselves.
 */
function paramsFor(path: string): Record<string, string> {
  return Object.fromEntries(
    [...path.matchAll(/:(\w+)/g)].map((match) => [match[1] as string, A_UUID]),
  );
}

/**
 * The Zod schemas a route validates, by source.
 *
 * Two passes, because `validate()` is all-or-nothing: it stores `req.valid`
 * only when *every* declared source parsed, and forwards one ZodError
 * otherwise. So a source that succeeds alongside a failing one is invisible in
 * either direction on its own — the first pass leaves the params empty so a
 * params schema announces itself by failing, the second fills them so the body
 * and query can announce themselves the same way. The union is what the route
 * actually declares.
 */
export function validatedSources(route: ProbedRoute): string[] {
  const sources = new Set<string>();

  for (const params of [{}, paramsFor(route.path)]) {
    for (const handler of route.handlers) {
      const req = { body: {}, query: {}, params } as unknown as Request;

      probe(handler, req, ((error?: unknown) => {
        const issues = (error as { issues?: { path: unknown[] }[] } | undefined)?.issues;
        for (const issue of issues ?? []) {
          const source = issue.path[0];
          if (typeof source === 'string') sources.add(source);
        }
      }) as NextFunction);

      for (const source of Object.keys((req as { valid?: object }).valid ?? {})) {
        sources.add(source);
      }
    }
  }

  return [...sources];
}

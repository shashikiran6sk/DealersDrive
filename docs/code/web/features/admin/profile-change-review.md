# web / features/admin/profile-change-review

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/admin/profile-change-review/comparison.tsx`

### `export function Comparison<T>({ live, proposed, render }: ComparisonProps<T>)`

Now, and what it would become.

`proposed === null` is the case worth the branch: it means _this request does
not touch this field_, and it has to read as **unchanged** rather than as
cleared. Rendering an empty row would tell the moderator the dealer wants
their services removed, and approving that reading would be approving
something nobody asked for.

## `apps/web/src/features/admin/profile-change-review/profile-change-review.constants.ts`

### `export const MIN_REFUSAL_REASON = 6`

Below this a reason is not a reason, and the dealer has nothing to act on.

## `apps/web/src/features/admin/profile-change-review/profile-change-review.tsx`

### `export function ProfileChangeReview({ change }: { change: AdminProfileChange })`

D3b — the review card for a dealer's proposed tagline and service list
(**R34**).

These two fields are the only free text a dealer writes that a buyer reads;
everything else on their profile screen has been read-only since R27. That
leaves exactly one route by which a phone number can reach a public page
without passing `POST /v1/vehicles/:id/reveal-contact` — the one endpoint
allowed to hand one out — and this card is where it gets caught. A moderator
is not asking "is this a nice tagline" but whether it contains a number, a
URL, a rival's name, or a claim the platform would be repeating.

**Old beside new, always**, because the question is "is this _change_
acceptable" and the two differ whenever the edit is a small correction to a
line already approved. A reviewer holding the old value in their head is one
who approves a number appended to a sentence they half-remember.

**The refusal needs a sentence**, which the dealer reads verbatim and is the
only account they get of why their line did not appear. Neither decision is
behind a confirm step: both are reversible in the way that matters, which is a
different category from `Reject dealership`.

### `router.refresh()`

The card disappears on the next render: `profileChange` is PENDING-only,

### `router.refresh()`

so a decided edit is simply no longer there.

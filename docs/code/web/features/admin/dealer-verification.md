# web / features/admin/dealer-verification

Parent: [web/features/admin](README.md)

## `apps/web/src/features/admin/dealer-verification/dealer-verification.tsx`

### `export function DealerVerificationReviewPanel({ initial }: { initial: DealerVerificationReview })`

The Dealer Verified decision. Since #299 it asks for the next status and nothing
else — a reason appears only for a rejection or a revocation, because those are the
decisions the dealer is told about.

The ten free-text assessment fields #297 required were removed rather than made
optional. They asked a reviewer to restate, in prose, checks the API can make itself:
the dealership is approved, its contact details are proved, and both document
categories were verified by an administrator and are still on file. A typed
attestation of those facts is weaker evidence than the facts, and a form that long
invites copy-paste. The API refuses VERIFIED when any of them is missing, so the
panel has nothing to collect.

### `const [saved, setSaved] = useState<DealerVerificationReview | null>(null)`

The saved review wins over `initial` only while it is for the same dealership and
newer. A stale server refresh after a save would otherwise put the old status back
on screen, and navigating to another dealership must not show this one's result.

### `import { decideDealerVerification } from '@/features/admin/dealer-verification/actions'`

Imported by alias rather than `./actions` so the sandbox can swap the Server Action
for a stub; a relative specifier cannot be aliased.

## `apps/web/src/features/admin/dealer-verification/verification-history.tsx`

### `export function VerificationHistory({ history })`

The latest hundred decisions. Reasons render as text, never HTML. Old entries that
carried an assessment still list; the assessment is not shown.

# web / features/dealer/portfolio-manager

Parent: [web](../../README.md)

The owner's Dealership photos page at `/dealer/photos` (**#299**): optional
portfolio photographs of the dealership, moderated before they are public.

## `apps/web/src/app/(dealer)/dealer/photos/page.tsx`

### `export default async function DealerPhotosPage()`

The page asks the session for `dealer:update` before it asks the API for
anything, and anyone else is sent to the dashboard — the same shape as the Team
page. Every portfolio route is OWNER only, so a manager shown this page would
be shown buttons that all end in a 403. The API's `requirePermission` is the
authority; this is the page not pretending.

The route is `/dealer/photos`, not `/dealer/portfolio`, because "portfolio"
already means the public dealership page in this codebase
(`DealerPortfolioPage`, the "portfolio inventory"); a dealer reads "Photos".

## `apps/web/src/components/dealer/console-nav/utils.ts`

### `export function consoleNavFor(permissions: readonly string[]): NavItem[]`

Photos is offered for `dealer:update` only, before Team. Like Team it has no
`short`, so it takes no slot in the five-tab bar below 768px; on a phone the
owner reaches it from the menu drawer.

## `apps/web/src/features/dealer/portfolio-manager/portfolio-manager.tsx`

### `export function PortfolioManager({ portfolio, paths }: PortfolioManagerProps)`

**Moderation before publication.** A dealer uploading a photo of their yard
expects to see it on their page, and it is not there until a reviewer approves
it. The page says so before anything else — "Photos appear on your public page
after our team approves them" — and every card carries its status in the
contract's own words (`PORTFOLIO_PHOTO_STATUS_LABELS`), so "Awaiting review —
not public yet" is never mistaken for a failure.

**Safe replacement.** Replace uploads a new photograph naming the approved one
(`replacesId`, in both the presign and the commit). The approved photograph
stays public until a reviewer approves its replacement, then the replacement
takes its position in the same transaction — so the page never shows both, or
neither. The API allows one waiting replacement per photograph
(`PORTFOLIO_REPLACEMENT_PENDING`), so Replace is hidden while one waits, and is
offered only on an APPROVED photograph (a pending one is replaced by removing
it; a rejected one by adding another).

**The limit is the API's.** `canAdd` and `limit` come from the response and the
Add button follows them; the "n of 8" count is approved and pending
photographs that are not replacements, the same rule the API counts by, so the
number and the disabled button cannot disagree. A refusal the client could not
foresee (`PORTFOLIO_FULL` racing another tab, a content mismatch) is shown in
the API's own sentence, read from the problem body.

Nothing here mentions Dealer Verified. Portfolio photographs are presentation,
not identity evidence, and a page that implied otherwise would teach dealers to
upload photos to get verified.

## `apps/web/src/features/dealer/portfolio-manager/portfolio-upload-dialog.tsx`

### `export function PortfolioUploadDialog(props: PortfolioUploadDialogProps)`

One dialog for Add and Replace: a file and an optional caption (≤ 120, the
contract's limit, enforced by `maxLength` so the API never has to refuse it).
The caption has to be chosen before the upload starts because the commit is
where it is recorded, so the upload is a deliberate Submit rather than the
yard-photo uploader's upload-on-select. The file is checked against the
contract's MIME list and 10 MB before anything is sent.

## `apps/web/src/features/dealer/portfolio-manager/portfolio-remove-dialog.tsx`

### `export function PortfolioRemoveDialog(props: PortfolioRemoveDialogProps)`

Remove is confirmed, and the sentence depends on what removing does: an
approved photograph comes off the public page at once; a pending one is
withdrawn from review; and an approved photograph with a waiting replacement
leaves that replacement in review as a new photograph — which the dealer should
hear before, not after.

## `apps/web/src/features/dealer/portfolio-manager/utils.ts`

### `export async function submitPortfolioPhoto(paths, file, submission)`

The presign → `PUT` → commit sequence, through the BFF. It reads the presign
response with `PortfolioPhotoPresignResponse` rather than `@/lib/upload`'s
`presign`, because that helper discards the problem body, and the API's
`PORTFOLIO_FULL` sentence is the useful thing to show.

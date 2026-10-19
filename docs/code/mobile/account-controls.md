# Customer account controls

## Deactivation transaction and shared-role boundary

`apps/api/src/modules/auth/customer-account.service.ts` accepts only a resolved customer and its exact live CUSTOMER session. `authenticatedAt` measures the original OTP proof, not delayed account setup/session issuance. `customer-access.ts` checks global and customer-seat availability, the dedicated customer flag and current phone/profile after a User row lock. Saved/enquiry/support writes use the same guard. This serializes protected mutations with deactivation and identity merging.

The deactivation transaction takes the stronger User update lock, rechecks session recency and current phone verification, withdraws sharing through `legal/contact-sharing.ts`, sets only `customerDeactivatedAt`, revokes CUSTOMER sessions and writes audit evidence. Dealer/admin/global state and sessions are unchanged. Existing cookie DEALER access to workspaces/invitations is preserved; native bearer remains excluded. Account merging propagates either identity's deactivated state, withdraws all combined grants and revokes surviving customer sessions.

## Reactivation proof

`customer-reactivation-ticket.ts` signs a purpose-separated ten-minute ticket using the existing session secret. Its nonce is atomically consumed through shared CachePort, failing closed on outage/replay. Fresh OTP can produce this ticket only for an otherwise eligible customer; no session is issued until explicit confirmation. Current identity, phone, profile, administrative status and proof epoch are checked under the User lock. Only the customer deactivation flag is cleared. Grant history is untouched.

The website's `sign-in-actions.ts` stores proof in an HttpOnly, production-Secure SameSite=Lax cookie. Client state receives a flow identifier, not the credential. Confirmation must match that flow and cannot replace an already active person session. A new sign-in clears old pending proof. Native `sign-in-screen` retains proof in memory only; cancellation/process death cannot replay an account mutation.

## Client ownership and uncertain delivery

Native account controls are keyed by authenticated owner and credential expiry. Web controls verify the expected owner again in server actions; the host preserves a successful deactivation receipt after logout but resets state on owner/recency change. Checkboxes start unticked. Fresh authentication does not automatically deactivate: the customer must confirm again. A malformed or failed response cannot display success.

Deletion-request forms create existing support tickets with fixed account category/subject and a stable UUID for the same uncertain submission; changed payloads use a new UUID. Owner changes discard private form state. The public web page supplies the same configured contact channel without requiring reactivation. Native links to that resource when signed out. Ticket receipts and follow-up are explicitly intake, not data erasure. There is no unsafe deletion endpoint.

## Components and evidence

Web `AccountControlsHost`, `AccountControls`, `DeletionRequest` and `CustomerReactivation` have registry entries and Storybook states using mocks. Native account/deletion screens reuse Page, StatusPanel, ConsentChoice and ActionButton, with account-keyed component tests. Existing symbols and wordmarks are unchanged. See [validation](../../mobile/f107-validation.md) and [fulfilment gate](../../mobile/deletion-fulfilment-runbook.md).

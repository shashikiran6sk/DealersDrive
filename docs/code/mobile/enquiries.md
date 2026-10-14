# Native enquiries and dealership sharing

F105 uses PR #279's enquiry, grant, withdrawal, immutable policy evidence and transaction services unchanged. There is no mobile consent database, local accepted flag, parallel policy version or new migration. The platform-neutral enquiry-client and legal-client exports move existing schemas unchanged, retaining original barrel names while excluding server policy archives and privileged DTOs from mobile imports.

## Form and authentication

Only an available car offers Enquire now. The dedicated native form retains its car route through authentication. An in-memory owned enquiry intent is consumed into the form, never into submission. The verified name/phone are read-only; the API derives identity from the customer session. An account or car change remounts the form, clearing private messages, consent and receipts before rendering another customer's context.

Publication metadata and receiver/sharing status load independently. Same-dealer reuse comes exclusively from server required=false; another dealer requires an unticked affirmative choice. Permission wording preserves the approved website categories and purpose; full server notice and Terms/Privacy are linked outside the concise form. Draft/publication states remain explicit and unavailable publication blocks submission.

Every explicit Send fetches current publication and receiver status together. A signature includes publication state, collection flag, receiver, requirement, notice version and hash. A changed signature clears the choice and requires review. The existing backend transaction remains authoritative if a listing, grant or notice changes after that check. Collection fields are omitted only while server collection is inactive, never as a fallback after refusal.

A synchronous lock prevents repeated taps. Only a server receipt displays success. No automatic POST retry, process-restored draft, background mutation replay or duplicate-positive fallback exists. The existing open-enquiry advisory lock blocks duplicates. A timeout/lost response tells the customer to check My enquiries; explicit retry can return the real already-open conflict. Policy errors navigate to Agreements; session expiry binds the original context to its previous owner and asks for authentication again.

## History and rights

My enquiries is keyset-paginated and uses server status labels; own detail resolves older enquiries directly. Only a validated /car/slug response is followed into native car navigation. Missing/withdrawn vehicle links remain absent. Customer query keys include ownership and are cleared on identity loss; late old-account results do not update the new account.

Privacy controls show effective owned dealership grants. Withdrawal requires an explicit native confirmation describing dealership-wide scope and the inability to recall already shared information. Selected legacy enquiry withdrawal uses the existing enquiry endpoint; linked-grant withdrawal preserves its broader scope. No new Terms acceptance gates these rights. Success invalidates owned grant/status/enquiry/history caches; failures are displayed and never reported as completion. Cross-platform tests exercise native creation, browser reuse, foreign denial, native withdrawal and browser re-grant without restoring an old immutable row.

Native rendering tests cover forms, stale receiver, explicit choices, repeated taps, uncertain responses, account switching and withdrawal confirmation. Device keyboard/back/TalkBack, live OTP and visual matching still require installed Android evidence.

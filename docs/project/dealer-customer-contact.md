# Dealer customer contact and response time

The customer contact number reuses the historical landline column. It accepts an Indian mobile or a landline with STD code and stores E.164. It is separate from the account mobile: there is no fallback to a login identity.

## Customer flow

Enquire now offers Call dealer and Request a callback when calling is available. Without an approved optional number, the only action is Request a callback, opening the enquiry form with its optional message directly. Both require the existing verified-mobile customer session. The action survives login. Public vehicle details carry only a canCall boolean. The approved number is returned only by POST /v1/vehicles/:slug/reveal-contact, with a strict empty body, no-store, limits of ten per customer and thirty per IP per hour, current listing/dealer availability checks, and a dealer.contact_revealed audit record. A reveal creates no enquiry, shares no customer mobile with the dealer, and does not assert a connected call. Callback uses the existing enquiry, inbox, email and tracking flow.

## Confirmation and approval

New onboarding describes customer-facing use and records confirmation when a number is provided. Standard application approval approves the confirmed number. An active owner can request adding, replacing, reconfirming or removing it through the existing profile-change queue. Approval publishes it atomically; refusal and withdrawal leave the approved number intact. These changes do not invalidate business verification. Managers and staff cannot change the number. Initial manual activation does not approve a contact number automatically.

Existing numbers are intentionally unapproved by the migration. The owner confirms them by saving the customer contact field, even when the digits have not changed, and an admin approves. Invalid legacy numbers must first be corrected. An admin correction through the general profile editor hides calling until dealer confirmation and a new contact approval; the editor explains this. Removal uses an explicit changed flag so null cannot mean both removal and omission.

## Response calculation

The median is the elapsed wall-clock minutes from enquiry creation to the first time the dealer marks it Contacted. Eligible enquiries were created in the past 90 days, have non-negative contact timestamps no later than now, and are not currently Spam. At least five samples are required. Closed and reopened enquiries retain their original contact timestamp. A direct close without Contacted supplies no sample. This measures the dealer's recorded action, not a verified callback or a connected call; contact reveals are excluded.

The metric is recalculated in the status transaction. A dealer-specific advisory lock serialises concurrent status updates and the daily refresh. The existing pg-boss worker runs dealers.response-times at 03:00 Asia/Kolkata to expire old samples. Public pages retain their normal short cache lifetime; status changes through the web also invalidate dealer profile caches. Missing data displays Not enough response data. Demo seeds no longer provide synthetic response measurements, and the migration clears old stored values. Real historical samples populate it on subsequent status changes or the daily refresh.

## Validation

Contracts cover formatted mobile/fixed-line inputs, invalid numbers, omission/removal and locked login identities. Integration tests cover authentication, public-number privacy, review, rejection, withdrawal, removal, role boundaries, unavailable cars/dealers, duplicate submissions, reveal rate limiting and response sample rules. The sandbox includes the two choices, callback only, revealed number and admin contact comparisons.

This is an approved product change from the legacy implementation: the legacy reveal used the account phone and created a call enquiry with a fabricated customer phone. The new flow uses explicitly approved business contact details and a separate audit event, and retains the existing real-customer callback enquiry model.

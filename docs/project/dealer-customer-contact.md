# Dealer customer contact, Call dealer and call leads

The customer contact number reuses the historical `landline` column. It accepts
an Indian mobile or a landline with STD code and stores E.164. It is separate
from the account mobile: there is never a fallback to a login identity.

Delivered by [PR #346](https://github.com/shashikiran6sk/DealersDrive/pull/346), squash-merged to `main` as `e34b8ff`. Owner decisions recorded on 28–30 Oct 2026 are marked
**(decision)**.

## Customer flow

- Before login every visitor sees only **Enquire now**, with "Requires login
  with your mobile number". Pressing it checks the session first; a signed-out
  visitor logs in and returns to the car. **(decision)**
- After login, a dealership with an approved number offers **Call dealer** or
  **Request a callback**; one without opens the enquiry form directly.
- Under Call dealer the customer is told: "The dealer will see your name and
  mobile number." **(decision)**
- Public vehicle details carry only a `canCall` boolean. The number is returned
  only by `POST /v1/vehicles/:slug/reveal-contact`: strict empty body,
  `no-store`, behind the customer legal gate, rate-limited to ten per customer
  and thirty per IP per hour, with listing and dealership availability checked.

## Call leads **(decision)**

Every reveal writes a `dealer.contact_revealed` audit row and a call lead in the
same transaction: one per customer and car. A repeat within 24 hours changes
nothing; a later one moves `lastRevealedAt` and adds to `revealCount`. Dealers
see them at `/dealer/enquiries/calls` and admins at `/admin/enquiries/calls`,
with the customer's current name and proved mobile. A lead is not an enquiry: no
status, no email, not in the inbox.

## Confirmation and approval

Two paths turn calling on:

1. **Dealer confirms, admin reviews.** The owner saves the customer contact
   field in their profile (even unchanged digits count as confirmation), which
   files a profile change; an admin approves it in Profile changes.
   Refusal or withdrawal leaves the approved number intact. Number changes do
   not invalidate business verification. Managers and staff cannot change it.
2. **Admin approves directly** **(decision, 30 Oct)**. On the admin dealer page,
   the Customer contact number panel shows the saved number and an **Approve
   for calls** button (`POST /v1/admin/dealers/:id/customer-contact/approve`,
   `admin:dealer:approve`, audited as `dealer.customer_contact.approved`). For
   numbers saved at onboarding as "landline" and for team-onboarded dealers.

Existing numbers are unapproved by the migration: when they were entered,
nobody was told customers would see them. Invalid legacy text must be corrected
first. Any later edit of the number by an admin withdraws the approval.

## Response time — removed **(decision)**

The original PR also computed a median response time. PR #349 removed the
public response-time stat, so the calculation, its daily job, its index and the
migration's reset were dropped from #346. `medianResponseMins` is unchanged.

## Not done here

- The privacy policy does not yet mention that the dealer sees the customer's
  name and mobile on Call dealer; changing it means a new policy version that
  customers accept again — the owner's decision.
- Admin email about enquiries is the separate daily summary (PR #359).

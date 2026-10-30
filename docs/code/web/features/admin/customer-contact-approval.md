# web / features/admin/customer-contact-approval

Parent: [web/features/admin](README.md)

## `apps/web/src/features/admin/customer-contact-approval/customer-contact-approval.tsx`

### `export function CustomerContactApproval({ dealerId, landline, approvedAt })`

The admin dealer page's answer to "can customers call this dealership?": the
saved customer contact number, whether it is approved, and an **Approve for
calls** button when it is not. It sits above the profile editor because the
editor is where a missing or wrong number is fixed, and fixing one withdraws
the approval — the hint under the panel says so, so an admin is not surprised
when Call dealer disappears after an edit.

A saved value that does not parse (legacy free text from the old "landline"
field) is shown as typed, with no button: approving it would be refused, and
the admin needs to see what is there to correct it.

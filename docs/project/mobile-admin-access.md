# Mobile admin access

PR 7 extends the current mobile revamp rather than replacing its navigation, tables or dialogs.
The actual parent was audited at 320, 390, 768 and 1280 pixels across dashboard, dealer/listing
queues, enquiries, support, configuration and security: all 28 combinations had no page-level
horizontal overflow. Existing drawers, responsive layouts, dialog scroll containment and mobile
44px button rules are preserved.

The marketplace mobile drawer now offers Dealer login, Admin login and Help and support below
Home, Buy cars and Dealers. Its existing Main heading remains for separately scoped PR 9.
Signed-in account menus also offer Admin login while preserving workspaces, customer actions,
keyboard navigation and logout. Footer links close the drawer even when the pathname is unchanged.
Admin discovery grants no permission; the existing backend and isolated admin cookie remain the
authority. Google and verified mobile OTP are the PR 6 authentication methods.

Admin queues opt into a visible mobile table swipe instruction. Their named focusable scroll
regions, captions, column semantics, pagination and actions remain intact. The shared Table
extension defaults off for other consumers. Card-dialog close buttons are at least 44px wide
on phones; desktop size stays unchanged. The overview queue header can wrap on phones while
retaining desktop alignment. No routes, permissions, database models or provider settings change.

Validation and actual post-creation browser screenshots belong in the campaign's PR 7 folder
on testing_evidence. Test Google/mobile discovery, authorization, refresh, navigation, dealer and
listing review, ticket replies, configuration, security and logout on phone/tablet/desktop
widths. Native Safari and physical-device keyboard testing require owner UAT and are not claimed
by Chromium viewport checks. Use synthetic data; mask contact, proof and document content.

DO NOT MERGE. No production deployment.

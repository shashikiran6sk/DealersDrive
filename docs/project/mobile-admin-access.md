# Mobile admin access

Administrators use Dealers-Drive as an installed Chrome PWA and cannot easily edit its URL, so
the admin sign-in page needs an in-app entry point. The owner's decision is a single, subtle
**Admin Login** link on `/login`, on the **Dealer** tab only, directly below "Trouble signing in?
Contact support". It routes to `/admin/login` with Next's in-app navigation, so the installed PWA
stays in its window. There is no gesture, counter or hidden interaction, no third tab, and the
Customer tab, brand, toggle, Google and OTP controls are unchanged.

`LoginTabs` renders the support link (`footer`) for both tabs exactly where the page used to,
and the admin link (`dealerFooter`) only while the Dealer tab is active, so the Customer view's
markup does not change. The link is 12px, `ink-subtle` (≈5.1:1 on white), keyboard-focusable
with a visible underline on focus and hover, and has a 40px-tall tap target.

Admin discovery grants no permission: `/admin/login` and the isolated admin session remain the
authority. The public marketplace drawer offers Dealer login and Help and support below Home,
Buy cars and Dealers, but no admin entry; the signed-in account menu has no admin entry either.
Links in the drawer footer close it even when the pathname is unchanged.

Admin queues opt into a visible mobile table swipe hint. Their named focusable scroll regions,
captions, column semantics, pagination and actions remain intact; the shared `Table` extension
defaults off for other consumers. Card-dialog close buttons are at least 44px on phones. The
overview queue header can wrap on phones while keeping desktop alignment. No routes,
permissions, database models or provider settings change.

Owner UAT: on the installed PWA, open `/login`, switch to Dealer, tap Admin Login, sign in with
Google or the linked mobile, and use Back. Native Safari and physical-device keyboard behaviour
are not covered by Chromium viewport checks.

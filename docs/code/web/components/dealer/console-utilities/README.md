# Console utilities

`ConsoleUtilities` is a server component passed as `ConsoleNav.footer`. It
preserves both existing logout modes. With a customer account, it calls the
same `customerLogoutAction`, announces the existing auth hint, and navigates to
`/`, matching the previous dealer account menu. Without that account snapshot,
it reuses `SignOutButton` with dealer scope and `/dealer/login`. Both existing
actions invalidate the session and clear cookies; switching workspace remains a
separate action. Authentication and server-action source are unchanged.

The dealer header no longer renders the public account avatar. Workspace
switching and invitations move into a keyboard-accessible disclosure inside
navigation. `WorkspaceSwitcher` uses the existing `WorkspaceItems`,
`enterWorkspaceAction` and navigation-safe action helper; current and suspended
membership states retain their original meanings. No customer profile, saved
cars or personal enquiry controls appear here. Public headers and account menus
keep their existing implementations.

`ConsoleNav.footer` is optional and does not change other console consumers.
The dealer layout shares one navigation element between its desktop sidebar
and the mobile drawer supplied by PR #285. Main does not contain that drawer:
this independent PR adds the utilities to the shared navigation, and PR #285
supplies the mobile host. Combine the two layout changes by retaining its
`navigation` constant with this footer, then pass it into the drawer. Do not
copy the mobile revamp or add another mobile navigation bar to this branch.

The sidebar navigation can scroll at short heights, and the workspace list is
bounded. Arrow keys, Home/End, Enter, Escape and Tab preserve keyboard access.

export const HEADER_ACCOUNT_TEXT = {
  login: 'Login',
  loginHref: '/login',
  logout: 'Logout',
  loggingOut: 'Logging out…',
  myEnquiries: 'My enquiries',
  myEnquiriesHref: '/enquiries',
  savedCars: 'Saved cars',
  savedCarsHref: '/saved',
  supportRequests: 'Support requests',
  supportRequestsHref: '/support-requests',
  dealerLogin: 'Dealer Login',
  dealerLoginHref: '/login?as=dealer',
  adminLogin: 'Admin login',
  adminLoginHref: '/admin/login',
  dealerDashboard: 'Dealer dashboard',
  workspaceLabel: (role: string) => `Dealer dashboard · ${role}`,
  workspaceCurrent: 'Current',
  workspaceSuspended: 'Suspended — dealer access is closed',
  workspacesLabel: 'Your dealerships',
  opening: 'Opening…',
  invitations: (count: number) =>
    count === 1 ? 'Dealership invitation · 1' : `Dealership invitations · ${String(count)}`,
  invitationsHref: '/invitations',
  menuLabel: (name: string) => `Account menu for ${name}`,
  menuItemsLabel: 'Account',
} as const;

export const ACCOUNT_ENDPOINT = '/api/account';

export const ACCOUNT_TIMEOUT_MS = 10_000;

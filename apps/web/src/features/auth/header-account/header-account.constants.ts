export const HEADER_ACCOUNT_TEXT = {
  login: 'Login',
  loginHref: '/login',
  logout: 'Logout',
  loggingOut: 'Logging out…',
  myEnquiries: 'My enquiries',
  myEnquiriesHref: '/enquiries',
  savedCars: 'Saved cars',
  savedCarsHref: '/saved',
  dealerLogin: 'Dealer Login',
  dealerLoginHref: '/dealer',
  menuLabel: (name: string) => `Account menu for ${name}`,
  menuItemsLabel: 'Account',
} as const;

export const HEADER_ACCOUNT_TEXT = {
  login: 'Login',
  loginHref: '/login',
  logout: 'Logout',
  myEnquiries: 'My enquiries',
  myEnquiriesHref: '/enquiries',
  greeting: (name: string) => `Hi, ${name}`,
  accountLabel: (name: string) => `Signed in as ${name}`,
} as const;

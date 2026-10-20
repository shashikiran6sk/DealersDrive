const titles: Readonly<Record<string, string>> = {
  about: 'About Dealers-Drive',
  account: 'Account controls',
  'account-deletion': 'Request account deletion',
  agreements: 'My agreements',
  'car/[slug]': 'Car details',
  'dealers/[slug]': 'Dealership',
  'enquire/[slug]': 'Send an enquiry',
  'enquiries/index': 'My enquiries',
  'enquiries/[id]': 'Enquiry details',
  'privacy-controls': 'Privacy controls',
  'sharing-notice': 'Sharing details and withdrawal',
  support: 'Contact & support',
  'support-requests/index': 'Support requests',
  'support-requests/new': 'New support request',
  'support-requests/[id]': 'Support conversation',
  'sign-in': 'Sign in',
};
export function stackTitle(name: string, params: unknown): string {
  if (name === 'policy/[documentId]') {
    const id =
      typeof params === 'object' && params !== null && 'documentId' in params
        ? params.documentId
        : undefined;
    return id === 'privacy' ? 'Privacy Policy' : id === 'terms' ? 'Terms & Conditions' : 'Policy';
  }
  return titles[name] ?? 'DealersDrive';
}

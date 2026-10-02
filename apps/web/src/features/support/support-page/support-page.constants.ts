export const SUPPORT_HREF = '/contact';

export const SUPPORT_TEXT = {
  metaTitle: 'Contact & support',
  metaDescription:
    'Reach the Dealers-Drive support team — for customers browsing and enquiring, and for dealerships listing on the platform.',
  eyebrow: "We're here to help",
  title: 'Contact Dealers-Drive',
  intro: 'Questions about a car, your account, or your dealership? Choose the right team below.',
  customerTitle: 'Customer support',
  customerBody: 'Help with browsing, saved cars, enquiries, and your customer account.',
  dealerTitle: 'Dealer support',
  dealerBody: 'Help with sign-in, onboarding, listings, verification, and enquiries.',
  whatsappTitle: 'Chat on WhatsApp',
  whatsappBody: 'Prefer to chat? Open a conversation with our support team in WhatsApp.',
  whatsappAction: 'Chat in WhatsApp',
  whatsappNewTab: '(opens in a new tab)',
  whatsappUnavailable: 'WhatsApp chat is not available yet. Email or call us instead.',
  emailLabel: 'Email',
  phoneLabel: 'Phone',
  requestTitle: 'Need help with a dealer, a car, an enquiry or your account?',
  requestBody:
    'Create a support request and our team will look into it. You can follow every reply from your account, and attach it to one of your enquiries so we can see the dealer and the car straight away.',
  requestAction: 'Create support request',
  requestHref: '/support-requests/new',
  requestsLink: 'View my support requests',
  requestsHref: '/support-requests',
  requestSignIn: 'You will be asked to sign in with your mobile number first.',
  otherWays: 'Other ways to reach us',
  help: 'Include your registered mobile number, and the car or listing you are asking about, so we can help faster.',
  externalArrow: '↗',
} as const;

export function mailtoHref(email: string): string {
  return `mailto:${email}`;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[\s-]/g, '')}`;
}

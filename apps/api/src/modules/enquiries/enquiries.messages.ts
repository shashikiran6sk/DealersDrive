export const LISTING_NOT_FOUND = 'That car is not on Dealers-Drive.';

export const LISTING_NOT_AVAILABLE =
  'This car is no longer available, so the dealership is not taking enquiries about it.';

export const LISTING_RESERVED =
  'This car is reserved for another buyer, so the dealership is not taking enquiries about it for now.';

export const OWN_LISTING = 'This car belongs to your own dealership.';

export const ALREADY_OPEN =
  'The dealership already has your details. You can enquire about this car again once they close your enquiry.';

export const ENQUIRY_RATE_LIMITED =
  'You have sent a lot of enquiries. Try again in a little while.';

export const ENQUIRY_NOT_FOUND = 'That enquiry is not in your inbox.';

export const ADMIN_ENQUIRY_NOT_FOUND = 'There is no enquiry with that id.';

export const ENQUIRY_HISTORY_LABELS: Record<string, string> = {
  'enquiry.created': 'Enquiry sent',
  'enquiry.contacted': 'Marked contacted',
  'enquiry.closed': 'Closed',
  'enquiry.spam': 'Marked as spam',
  'enquiry.reopened': 'Reopened',
};

export const ENQUIRY_ACTOR_LABELS: Record<string, string> = {
  CUSTOMER: 'Customer',
  DEALER: 'Dealer',
  ADMIN: 'Dealers-Drive',
  SYSTEM: 'System',
};

export const ENQUIRY_IMAGE_ALT = (title: string) => `Photograph of the ${title}`;

export const PHONE_TICKET_EXPIRED =
  'That mobile verification has expired or was already used. Verify the dealer’s number again.';

export const TICKET_GUARD_UNAVAILABLE =
  'We could not confirm the mobile verification just now. Try again in a moment.';

export const DEALER_PHONE_TAKEN =
  'This mobile number already belongs to a dealership on Dealers-Drive. Ask the dealer to sign in, or contact operations.';

export const ASSISTED_DEALER_NOT_FOUND = 'That dealership is not one you are assisting.';

export const ASSISTED_DEALER_LOCKED =
  'This dealership has been submitted, so it can no longer be edited here.';

export const SALES_APPROVED_LABEL = 'Approved';

export const EMAIL_TICKET_EXPIRED =
  'That email verification has expired or was already used. Verify the dealer’s email again.';

export const EMAIL_CODE_INVALID = 'That code is not right. Check the email and try again.';

export const EMAIL_CODE_EXPIRED = 'That code has expired. Send a new one.';

export const EMAIL_CODE_LOCKED = 'Too many wrong codes. Send a new one.';

export const EMAIL_CODE_COOLDOWN = (seconds: number) =>
  `A code was sent a moment ago. You can send another in ${String(seconds)} seconds.`;

export const EMAIL_CODE_TOO_MANY =
  'Too many codes have been sent to this email. Try again in an hour.';

export const EMAIL_CODE_SEND_FAILED =
  'We could not send the code just now. Check the address and try again.';

export const DEALER_EMAIL_TAKEN =
  'This email already belongs to a dealership on Dealers-Drive. Ask the dealer to sign in, or use a different email.';

export const VERIFY_NOT_NEEDED = 'This dealership already has an owner account.';

export const VERIFY_PHONE_MISMATCH =
  'Verify the mobile number this dealership was registered with.';

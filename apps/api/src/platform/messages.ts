export const ALREADY_REGISTERED = 'Already registered.';

export const UPLOAD_NOT_FOUND = 'That upload does not exist.';
export const UPLOAD_INCOMPLETE = 'The upload did not complete. Try again.';
export const DOCUMENT_NOT_FOUND = 'That document does not exist.';

export const MALFORMED_REQUEST = 'The request did not match the expected shape.';

export const UNNAMED_CUSTOMER = 'Customer';

export const UNNAMED_MEMBER = 'Name not given yet';

export const ADMIN_CONSOLE_REFUSAL = {
  code: 'ADMIN_CONSOLE_FORBIDDEN',
  message: 'Your role does not include the admin console.',
} as const;

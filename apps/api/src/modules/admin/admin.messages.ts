export const DEALER_NOT_FOUND = 'That dealership does not exist.';

export const DEALER_NOT_CLOSABLE =
  'Only a draft or in-review application can be closed. An active dealership can be suspended instead.';

export const CLOSED_NOT_REJECTABLE =
  'A closed application is kept on record, not purged. It cannot be rejected.';

export const OVERRIDE_FORBIDDEN =
  'Only a Super admin can activate a dealership without the standard document review.';

export const OVERRIDE_ACCESS_REVOKED = 'Your manual activation access is no longer available.';

export const OVERRIDE_NOT_AWAITING =
  'Only an application awaiting activation can be activated manually. A suspended dealership is reinstated instead.';

export const OVERRIDE_SELF_REVIEW =
  'You assisted with or belong to this dealership, so another administrator has to decide it.';

export const OVERRIDE_ACCOUNT_INCOMPLETE =
  "The owner's account is incomplete: a verified mobile number and a verified email are required. Those checks are never waived.";

export const CONTACT_NOT_VERIFIED =
  "The owner's mobile number and email must both be verified before this dealership can be approved.";

export const OVERRIDE_BUSINESS_INCOMPLETE =
  'Complete the business details first. Manual activation waives only the document review.';

export const OVERRIDE_DOCUMENT_REJECTED =
  'A reviewer rejected a submitted document. Resolve the rejection before activating.';

export const OVERRIDE_STANDARD_AVAILABLE =
  'Both document categories are verified. Use standard approval instead.';

export const OVERRIDE_NOT_ACTIVE =
  'This dealership was not activated manually, so there is nothing to withdraw.';

export const OVERRIDE_REVOKED_VERIFICATION =
  'The manual activation was withdrawn; a new verification review is required.';

export const YARD_VISIT_FORBIDDEN =
  'Only reviewers with yard-visit access can record or read yard visits.';

export const YARD_VISIT_ACCESS_REVOKED = 'Your yard-visit access is no longer available.';

export const YARD_VISIT_NOT_FOUND = 'That yard visit does not exist.';

export const YARD_VISIT_PHOTO_LIMIT_REACHED =
  'This visit already holds the most photographs it can. Record another visit instead.';

export const YARD_VISIT_PHOTO_MISMATCH =
  'That file is not a JPEG, PNG or WebP photograph of the type it was uploaded as. Choose the photograph again.';

export const CUSTOMER_CONTACT_MISSING =
  'This dealership has no valid customer contact number to approve. Add one in the profile editor first.';

export const MEMBER_NOT_FOUND = 'That person is not a member of your dealership.';

export const INVITATION_NOT_FOUND = 'There is no invitation waiting there.';

export const ALREADY_MEMBER = 'That number already belongs to a member of this dealership.';

export const OWNER_LOCKED =
  'The owner’s place cannot be changed here. Contact support if the dealership has changed hands.';

export const INVITATION_EXPIRED =
  'This invitation has expired. Ask the dealership to invite your number again.';

export const INVITATION_CLOSED: Record<string, string> = {
  ACCEPTED: 'This invitation has already been accepted.',
  DECLINED: 'This invitation was declined. Ask the dealership to invite your number again.',
  REVOKED: 'The dealership withdrew this invitation.',
  EXPIRED: INVITATION_EXPIRED,
};

export const DEALERSHIP_NOT_ACCEPTING =
  'That dealership is not taking new members right now. Ask them, or contact support.';

export const ALREADY_IN_DEALERSHIP = 'You are already a member of this dealership.';

import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

const INVITATION_EXAMPLE = {
  id: '5b6c7d8e-9f01-4234-8567-89abcdef0123',
  phoneDisplay: '+91 98765 00001',
  role: 'STAFF',
  roleLabel: 'Staff',
  status: 'PENDING',
  statusLabel: 'Waiting for sign-in',
  invitedAt: '2026-10-02T09:30:00.000Z',
  expiresAt: '2026-10-09T09:30:00.000Z',
  expiresLabel: '9 Oct 2026',
};

const MEMBER_EXAMPLE = {
  id: '7d1e2f3a-4b5c-4d6e-8f70-81a2b3c4d5e6',
  name: 'Arun Kumar',
  initials: 'AK',
  phoneDisplay: '+91 98765 00002',
  email: null,
  role: 'MANAGER',
  roleLabel: 'Manager',
  joinedAt: '2026-10-02T09:45:00.000Z',
  joinedLabel: '2 Oct 2026',
  isYou: false,
  manageable: true,
};

export const teamDocs: ModuleDocs = {
  tag: DOC_TAGS.team,
  description:
    'A dealership’s people (**R94**). One OWNER runs it; the owner invites MANAGER and STAFF ' +
    'members by mobile number. Roles are fixed — what each may do is `DEALER_PERMISSIONS` in ' +
    'contracts, enforced on every dealer route.\n\n' +
    '**An invitation is held against a number, never an account, and carries no token.** ' +
    'Whoever next proves that number with the ordinary customer sign-in sees it under ' +
    '`GET /v1/invitations` and may accept: an existing customer keeps their account and gains ' +
    'the dealership; somebody new signs up with the same OTP first. Nothing is sent, so there ' +
    'is no link to forward or replay — acceptance compares the invitation’s number with the ' +
    'session’s verified number, on the server.\n\n' +
    '**The owner is fixed in V1**: the OWNER row can be neither demoted nor removed, so a ' +
    'dealership can never be left without one. Every team write locks the dealership row, so ' +
    'two owner devices cannot race each other into a duplicate invitation or a half-removed ' +
    'member. Another dealership’s member or invitation is a 404.',
  operations: [
    {
      method: 'get',
      path: '/v1/dealer/team',
      operationId: 'getDealerTeam',
      tag: DOC_TAGS.team,
      summary: 'The team, and invitations waiting',
      description:
        'Active members — OWNER first, then MANAGER, then STAFF, each by when they joined — ' +
        'and the invitations still waiting. A waiting invitation past its expiry is reported ' +
        'as `EXPIRED`; inviting the number again renews it.',
      audience: 'dealer',
      permission: 'member:manage',
      responses: [
        {
          status: 200,
          description: 'The team.',
          schema: 'DealerTeamResponse',
          example: { members: [MEMBER_EXAMPLE], invitations: [INVITATION_EXAMPLE] },
        },
      ],
      errors: [401, 403],
    },
    {
      method: 'post',
      path: '/v1/dealer/team/invitations',
      operationId: 'inviteDealerMember',
      tag: DOC_TAGS.team,
      summary: 'Invite a mobile number',
      description:
        'Invites a number as MANAGER or STAFF — never OWNER — for seven days. Inviting a ' +
        'number that is already waiting renews that invitation with the new role rather than ' +
        'adding a second (a partial unique index makes that true under a race). A number that ' +
        'already belongs to an active member is a 409 `MEMBER_ALREADY_EXISTS`. The dealership ' +
        'must be ACTIVE, and may hold at most 25 unexpired invitations at once — the 26th is a ' +
        '409 `TOO_MANY_INVITATIONS`, while renewing one already waiting always succeeds. ' +
        'Audited as `member.invited` or `member.invitation_renewed`; the number ' +
        'itself is not written to the audit log.',
      audience: 'dealer',
      permission: 'member:manage',
      requestBody: {
        schema: 'InviteMemberInput',
        example: { phone: '98765 00001', role: 'STAFF' },
      },
      responses: [
        {
          status: 201,
          description: 'The invitation.',
          schema: 'TeamInvitation',
          example: INVITATION_EXAMPLE,
        },
      ],
      errors: [400, 401, 403, 409],
    },
    {
      method: 'delete',
      path: '/v1/dealer/team/invitations/:id',
      operationId: 'revokeDealerInvitation',
      tag: DOC_TAGS.team,
      summary: 'Withdraw an invitation',
      description:
        'A waiting invitation can no longer be accepted. One that was already accepted, ' +
        'declined or withdrawn, or another dealership’s, is a 404.',
      audience: 'dealer',
      permission: 'member:manage',
      params: 'IdParam',
      responses: [{ status: 204, description: 'Withdrawn.' }],
      errors: [400, 401, 403, 404],
    },
    {
      method: 'patch',
      path: '/v1/dealer/team/members/:id',
      operationId: 'changeDealerMemberRole',
      tag: DOC_TAGS.team,
      summary: 'Change a member’s role',
      description:
        'MANAGER ⇄ STAFF. Takes effect on the member’s very next request — the role is read ' +
        'from this row every time, never from their session. The OWNER’s role is a 409 ' +
        '`OWNER_LOCKED`. Audited as `member.role_changed`.',
      audience: 'dealer',
      permission: 'member:manage',
      params: 'IdParam',
      requestBody: { schema: 'UpdateMemberInput', example: { role: 'STAFF' } },
      responses: [
        {
          status: 200,
          description: 'The member, with the new role.',
          schema: 'TeamMember',
          example: { ...MEMBER_EXAMPLE, role: 'STAFF', roleLabel: 'Staff' },
        },
      ],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'delete',
      path: '/v1/dealer/team/members/:id',
      operationId: 'removeDealerMember',
      tag: DOC_TAGS.team,
      summary: 'Remove a member',
      description:
        'The member loses the dealership on their very next request. Their account — saved ' +
        'cars, enquiries, their session — is untouched: only the dealership goes. The row is ' +
        'kept as REMOVED for the audit trail, and a later invitation reactivates it. The ' +
        'OWNER is a 409 `OWNER_LOCKED`. Audited as `member.removed`.',
      audience: 'dealer',
      permission: 'member:manage',
      params: 'IdParam',
      responses: [{ status: 204, description: 'Removed.' }],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'get',
      path: '/v1/invitations',
      operationId: 'listMyDealerInvitations',
      tag: DOC_TAGS.team,
      summary: 'Invitations waiting for you',
      description:
        'Dealerships that have invited the signed-in person’s **verified** number, still ' +
        'waiting and unexpired, from an ACTIVE dealership the person is not already in. The ' +
        'number comes from the session, never from the request.',
      audience: 'customer',
      responses: [
        {
          status: 200,
          description: 'The invitations.',
          schema: 'MyInvitationsResponse',
          example: {
            data: [
              {
                id: INVITATION_EXAMPLE.id,
                dealer: { brandName: 'ABC Motors', city: 'Vellore' },
                role: 'STAFF',
                roleLabel: 'Staff',
                invitedByName: 'Shashikiran',
                expiresAt: INVITATION_EXAMPLE.expiresAt,
                expiresLabel: INVITATION_EXAMPLE.expiresLabel,
              },
            ],
          },
        },
      ],
    },
    {
      method: 'post',
      path: '/v1/invitations/:id/accept',
      operationId: 'acceptDealerInvitation',
      tag: DOC_TAGS.team,
      summary: 'Join a dealership',
      description:
        'Joins with the invitation’s role, on the session the person already has — no dealer ' +
        'onboarding and no verification: those belong to the dealership, which has them. An ' +
        'invitation for another number is a 404. One that has expired, was withdrawn, or was ' +
        'already answered is a 409 naming which (`INVITATION_EXPIRED`, `INVITATION_CLOSED`), ' +
        'so a replay does nothing. A removed member accepting a new invitation gets their old ' +
        'row back. Audited as `member.joined`.',
      audience: 'customer',
      params: 'IdParam',
      responses: [
        {
          status: 200,
          description: 'The new membership, ready to enter.',
          schema: 'AcceptInvitationResponse',
          example: {
            membershipId: MEMBER_EXAMPLE.id,
            dealer: { brandName: 'ABC Motors' },
            role: 'STAFF',
            roleLabel: 'Staff',
          },
        },
      ],
      errors: [400, 401, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/invitations/:id/decline',
      operationId: 'declineDealerInvitation',
      tag: DOC_TAGS.team,
      summary: 'Decline an invitation',
      description:
        'The invitation stops waiting. The same rules as accepting decide who may, and when.',
      audience: 'customer',
      params: 'IdParam',
      responses: [{ status: 204, description: 'Declined.' }],
      errors: [400, 401, 404, 409],
    },
  ],
};

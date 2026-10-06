import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

export const adminMembersDocs: ModuleDocs = {
  tag: DOC_TAGS.adminMembers,
  description:
    'Internal team members (**R111**): who may open the admin console or the Sales ' +
    'workspace, in which role, and whether that is still true. Every route requires ' +
    '`admin:access:manage` (Super admin).\n\n' +
    'A member is `INVITED` until their first Google sign-in, then `ACTIVE`; `DISABLED` ' +
    'ends their privileged sessions at once. A role change applies on the member’s next ' +
    'request — permissions are read from the member record on every request.\n\n' +
    'Members admitted by `ADMIN_ALLOWLIST` (`source: BOOTSTRAP`) and your own membership ' +
    'cannot be changed here, and the last active Super admin cannot be disabled or ' +
    're-roled. Every change is audited with the member who made it.',
  operations: [
    {
      method: 'get',
      path: '/v1/admin/members',
      operationId: 'listAdminMembers',
      tag: DOC_TAGS.adminMembers,
      summary: 'Every internal team member',
      description:
        'Invited members first, then active, then disabled. Filter by `status` and `role`; ' +
        '`counts` is per status under the role filter.',
      audience: 'admin',
      permission: 'admin:access:manage',
      query: 'AdminMembersQuery',
      responses: [{ status: 200, description: 'The team.', schema: 'AdminMembersResponse' }],
      errors: [400, 401, 403],
    },
    {
      method: 'post',
      path: '/v1/admin/members',
      operationId: 'inviteAdminMember',
      tag: DOC_TAGS.adminMembers,
      summary: 'Invite a team member',
      description:
        'Creates the member as `INVITED` with the chosen role. They sign in with Google at ' +
        '`/admin/login` using exactly this address; that first sign-in activates them. ' +
        'An address that is already a member is a **409** — change their role or ' +
        're-activate them instead. Audited as `admin_member.invited`.',
      audience: 'admin',
      permission: 'admin:access:manage',
      requestBody: {
        schema: 'InviteAdminMemberInput',
        description: 'The Google address, an optional display name, and the role.',
        example: { email: 'field.sales@dealers-drive.in', name: 'Field Sales', role: 'SALES_REP' },
      },
      responses: [{ status: 201, description: 'Invited.', schema: 'AdminMemberDto' }],
      errors: [400, 401, 403, 409],
    },
    {
      method: 'get',
      path: '/v1/admin/members/:id/history',
      operationId: 'getAdminMemberHistory',
      tag: DOC_TAGS.adminMembers,
      summary: 'A team member and their audit history',
      description:
        'The member, and the most recent fifty audit entries about them — invited, ' +
        'activated, role changed, disabled, re-activated, signed in — each with the member ' +
        'who acted.',
      audience: 'admin',
      permission: 'admin:access:manage',
      params: 'IdParam',
      responses: [
        { status: 200, description: 'The history.', schema: 'AdminMemberHistoryResponse' },
      ],
      errors: [400, 401, 403, 404],
    },
    {
      method: 'patch',
      path: '/v1/admin/members/:id',
      operationId: 'changeAdminMemberRole',
      tag: DOC_TAGS.adminMembers,
      summary: 'Change a team member’s role',
      description:
        'Effective on their next request. Refused for yourself (**403**), an allow-listed ' +
        'member (**409**) and the last active Super admin (**409**). Audited as ' +
        '`admin_member.role_changed` with the old and new role.',
      audience: 'admin',
      permission: 'admin:access:manage',
      params: 'IdParam',
      requestBody: {
        schema: 'UpdateAdminMemberInput',
        description: 'The new role.',
        example: { role: 'MODERATOR' },
      },
      responses: [{ status: 200, description: 'Updated.', schema: 'AdminMemberDto' }],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/admin/members/:id/disable',
      operationId: 'disableAdminMember',
      tag: DOC_TAGS.adminMembers,
      summary: 'Disable a team member',
      description:
        'Marks them `DISABLED` and **revokes their privileged sessions** — the console or ' +
        'Sales workspace closes on their next click. Their record and everything they did ' +
        'stay in the audit trail. Same refusals as a role change. Audited as ' +
        '`admin_member.disabled` with the reason.',
      audience: 'admin',
      permission: 'admin:access:manage',
      params: 'IdParam',
      requestBody: {
        schema: 'DisableAdminMemberInput',
        description: 'Why, in a sentence — kept on the member and in the audit trail.',
        example: { reason: 'Left the company on 6 October.' },
      },
      responses: [{ status: 200, description: 'Disabled.', schema: 'AdminMemberDto' }],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/admin/members/:id/activate',
      operationId: 'activateAdminMember',
      tag: DOC_TAGS.adminMembers,
      summary: 'Re-activate a disabled team member',
      description:
        'Back to `ACTIVE` if they had ever signed in, otherwise `INVITED`. Only a disabled ' +
        'member can be re-activated (**409** otherwise). Audited as ' +
        '`admin_member.reactivated`.',
      audience: 'admin',
      permission: 'admin:access:manage',
      params: 'IdParam',
      responses: [{ status: 200, description: 'Re-activated.', schema: 'AdminMemberDto' }],
      errors: [400, 401, 403, 404, 409],
    },
  ],
};

export const MEMBER_NOT_FOUND = 'That team member does not exist.';

export const MEMBER_SELF =
  'You cannot change or disable your own membership. Ask another Super admin.';

export const MEMBER_BOOTSTRAP =
  'This address is on ADMIN_ALLOWLIST, so the deployment decides its access. Change it there.';

export const MEMBER_ALREADY_EXISTS =
  'That address is already a team member. Change their role or re-activate them instead.';

export const MEMBER_NOT_DISABLED = 'That team member is not disabled.';

export const MEMBER_ALREADY_DISABLED = 'That team member is already disabled.';

export const LAST_SUPER_ADMIN =
  'This is the last active Super admin. Make someone else a Super admin first.';

export const HISTORY_LABELS: Readonly<Record<string, string>> = {
  'admin_member.invited': 'Invited',
  'admin_member.activated': 'Activated',
  'admin_member.reactivated': 'Re-activated',
  'admin_member.role_changed': 'Role changed',
  'admin_member.disabled': 'Disabled',
  'admin.login.success': 'Signed in',
};

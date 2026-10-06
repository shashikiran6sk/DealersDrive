import { describe, expect, it } from 'vitest';

import { adminNavFor } from '@/components/admin/admin-nav';

/**
 * The console's sidebar offers what the member's role can open. Hiding an
 * item is not the authorization — the API refuses the page's own request —
 * but a link that always ends in "forbidden" is a broken link.
 */
describe('adminNavFor', () => {
  it('offers Members and Configuration only to a Super admin', () => {
    const superAdmin = adminNavFor(['admin:console', 'admin:access:manage', 'admin:config:write']);
    expect(superAdmin.map((item) => item.href)).toEqual(
      expect.arrayContaining(['/admin/members', '/admin/config']),
    );

    const support = adminNavFor(['admin:console', 'admin:support:manage']).map((item) => item.href);
    expect(support).not.toContain('/admin/members');
    expect(support).not.toContain('/admin/config');
    expect(support).toContain('/admin/support');
  });

  it('never offers an item that has not landed', () => {
    expect(adminNavFor(['admin:console']).map((item) => item.href)).not.toContain(
      '/admin/payments',
    );
  });
});

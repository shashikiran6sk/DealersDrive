import type { AdminRole, DealerRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  ADMIN_PERMISSIONS,
  PERMISSIONS,
  permissionsForAdminRole,
  permissionsForRole,
} from '../../../../src/modules/auth/session.port.js';

/**
 * ARCHITECTURE §8.3's role matrix, asserted rather than described. These
 * tables are the authorization model in full, so the tests below are written
 * as the questions an auditor would ask: which seats can spend money, which
 * can publish, and which can only look.
 *
 * The negative assertions matter more than the positive ones. A permission
 * wrongly *added* to SALES is a privilege escalation that no route-level test
 * would notice, because every route would still be doing exactly what it was
 * told.
 */

const DEALER_ROLES: DealerRole[] = ['OWNER', 'MANAGER', 'SALES'];
const ADMIN_ROLES: AdminRole[] = ['SUPPORT', 'MODERATOR', 'SUPER_ADMIN'];

describe('permissionsForRole', () => {
  it('gives OWNER every dealer permission', () => {
    expect(permissionsForRole('OWNER').sort()).toEqual(Object.keys(PERMISSIONS).sort());
  });

  /** Money and identity are the owner's alone. */
  it.each(['dealer:update', 'document:upload', 'billing:purchase', 'member:manage'])(
    'reserves %s to OWNER',
    (permission) => {
      expect(permissionsForRole('OWNER')).toContain(permission);
      expect(permissionsForRole('MANAGER')).not.toContain(permission);
      expect(permissionsForRole('SALES')).not.toContain(permission);
    },
  );

  it('lets MANAGER run the inventory but not the dealership', () => {
    const manager = permissionsForRole('MANAGER');

    expect(manager).toEqual(
      expect.arrayContaining([
        'vehicle:read',
        'vehicle:write',
        'vehicle:delete',
        'listing:submit',
        'listing:renew',
        'photo:request',
        'billing:read',
      ]),
    );
    expect(manager).not.toContain('billing:purchase');
  });

  /** A salesperson works leads. They cannot spend a credit or change a price. */
  it('limits SALES to reading vehicles and working enquiries', () => {
    expect(permissionsForRole('SALES').sort()).toEqual(
      ['enquiry:read', 'enquiry:update', 'vehicle:read'].sort(),
    );
  });

  it.each(['vehicle:write', 'vehicle:delete', 'listing:submit', 'listing:renew'])(
    'keeps %s away from SALES',
    (permission) => {
      expect(permissionsForRole('SALES')).not.toContain(permission);
    },
  );

  it('lets every role read the enquiries they are meant to work', () => {
    for (const role of DEALER_ROLES) {
      expect(permissionsForRole(role)).toContain('enquiry:read');
    }
  });

  it('gives every role at least vehicle:read, so no seat is dead', () => {
    for (const role of DEALER_ROLES) {
      expect(permissionsForRole(role)).toContain('vehicle:read');
    }
  });

  it('is a strict hierarchy — MANAGER ⊇ SALES and OWNER ⊇ MANAGER', () => {
    const owner = new Set(permissionsForRole('OWNER'));
    const manager = new Set(permissionsForRole('MANAGER'));

    expect(permissionsForRole('SALES').every((p) => manager.has(p))).toBe(true);
    expect(permissionsForRole('MANAGER').every((p) => owner.has(p))).toBe(true);
  });

  it('returns no duplicates', () => {
    for (const role of DEALER_ROLES) {
      const permissions = permissionsForRole(role);
      expect(new Set(permissions).size).toBe(permissions.length);
    }
  });

  it('grants nothing to a role outside the enum', () => {
    expect(permissionsForRole('INTERN' as DealerRole)).toEqual([]);
  });
});

describe('permissionsForAdminRole', () => {
  it('gives SUPER_ADMIN every admin permission', () => {
    expect(permissionsForAdminRole('SUPER_ADMIN').sort()).toEqual(
      Object.keys(ADMIN_PERMISSIONS).sort(),
    );
  });

  /**
   * The three that move money or change platform behaviour. A moderator
   * approves listings; they do not hand out credits, issue refunds, or rewrite
   * the pack prices.
   */
  it.each(['admin:credit:grant', 'admin:payment:refund', 'admin:config:write'])(
    'reserves %s to SUPER_ADMIN',
    (permission) => {
      expect(permissionsForAdminRole('SUPER_ADMIN')).toContain(permission);
      expect(permissionsForAdminRole('MODERATOR')).not.toContain(permission);
      expect(permissionsForAdminRole('SUPPORT')).not.toContain(permission);
    },
  );

  it('lets MODERATOR moderate but not settle', () => {
    const moderator = permissionsForAdminRole('MODERATOR');

    expect(moderator).toEqual(
      expect.arrayContaining([
        'admin:dealer:approve',
        'admin:document:review',
        'admin:listing:moderate',
        'admin:media:upload',
      ]),
    );
    expect(moderator).not.toContain('admin:payment:refund');
  });

  /** Support answers tickets: they read payments, audits and metrics, and write nothing. */
  it('limits SUPPORT to read-only permissions', () => {
    expect(permissionsForAdminRole('SUPPORT').sort()).toEqual(
      ['admin:audit:read', 'admin:metrics:read', 'admin:payment:read'].sort(),
    );
  });

  it('gives SUPPORT no permission whose name implies a write', () => {
    for (const permission of permissionsForAdminRole('SUPPORT')) {
      expect(permission).toMatch(/:read$/);
    }
  });

  it('is a strict hierarchy — MODERATOR ⊇ SUPPORT and SUPER_ADMIN ⊇ MODERATOR', () => {
    const superAdmin = new Set(permissionsForAdminRole('SUPER_ADMIN'));
    const moderator = new Set(permissionsForAdminRole('MODERATOR'));

    expect(permissionsForAdminRole('SUPPORT').every((p) => moderator.has(p))).toBe(true);
    expect(permissionsForAdminRole('MODERATOR').every((p) => superAdmin.has(p))).toBe(true);
  });

  it('returns no duplicates', () => {
    for (const role of ADMIN_ROLES) {
      const permissions = permissionsForAdminRole(role);
      expect(new Set(permissions).size).toBe(permissions.length);
    }
  });

  it('grants nothing to a role outside the enum', () => {
    expect(permissionsForAdminRole('INTERN' as AdminRole)).toEqual([]);
  });
});

describe('the tables themselves', () => {
  /** A permission nobody holds is dead code; one everybody holds is not a permission. */
  it('grants every dealer permission to at least one role', () => {
    for (const [permission, roles] of Object.entries(PERMISSIONS)) {
      expect(roles.length, permission).toBeGreaterThan(0);
    }
  });

  it('grants every admin permission to at least one role', () => {
    for (const [permission, roles] of Object.entries(ADMIN_PERMISSIONS)) {
      expect(roles.length, permission).toBeGreaterThan(0);
    }
  });

  it('names every dealer permission `resource:action`', () => {
    for (const permission of Object.keys(PERMISSIONS)) {
      expect(permission).toMatch(/^[a-z]+:[a-z]+$/);
    }
  });

  /** The `admin:` prefix is what keeps the two namespaces from ever colliding. */
  it('prefixes every admin permission with `admin:`', () => {
    for (const permission of Object.keys(ADMIN_PERMISSIONS)) {
      expect(permission).toMatch(/^admin:[a-z]+:[a-z]+$/);
    }
  });

  it('shares no permission name between the two tables', () => {
    const dealer = new Set(Object.keys(PERMISSIONS));

    for (const permission of Object.keys(ADMIN_PERMISSIONS)) {
      expect(dealer.has(permission)).toBe(false);
    }
  });
});

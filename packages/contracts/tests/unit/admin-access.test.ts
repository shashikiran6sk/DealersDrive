import { describe, expect, it } from 'vitest';

import {
  ADMIN_PERMISSION_NAMES,
  ADMIN_ROLE_LABELS,
  AdminRole,
  adminHomeFor,
  adminPermissionsFor,
  canAdmin,
} from '../../src/index.js';

describe('the Admin Member permission table', () => {
  it('keeps a Sales Representative out of the admin console entirely', () => {
    const sales = adminPermissionsFor('SALES_REP');

    expect(sales).not.toContain('admin:console');
    expect(sales.every((permission) => permission.startsWith('sales:'))).toBe(true);
  });

  it('gives no reviewer decision to a Sales Representative', () => {
    const sales = adminPermissionsFor('SALES_REP');

    for (const decision of [
      'admin:dealer:approve',
      'admin:document:review',
      'admin:listing:moderate',
      'admin:config:write',
      'admin:access:manage',
      'admin:enquiry:read',
      'admin:support:manage',
    ] as const) {
      expect(canAdmin(sales, decision)).toBe(false);
    }
  });

  it('keeps the Sales workspace to Sales Representatives', () => {
    for (const role of ['SUPPORT', 'MODERATOR', 'SUPER_ADMIN'] as const) {
      expect(adminPermissionsFor(role).some((p) => p.startsWith('sales:'))).toBe(false);
      expect(adminPermissionsFor(role)).toContain('admin:console');
    }
  });

  it('keeps member management and configuration to Super admins', () => {
    expect(canAdmin(adminPermissionsFor('SUPER_ADMIN'), 'admin:access:manage')).toBe(true);
    expect(canAdmin(adminPermissionsFor('MODERATOR'), 'admin:access:manage')).toBe(false);
    expect(canAdmin(adminPermissionsFor('SUPPORT'), 'admin:config:write')).toBe(false);
  });

  it('labels every role and answers nothing for no session', () => {
    for (const role of AdminRole.options) expect(ADMIN_ROLE_LABELS[role]).toBeTruthy();
    expect(ADMIN_ROLE_LABELS.MODERATOR).toBe('Operations');
    expect(canAdmin(null, 'admin:console')).toBe(false);
    expect(ADMIN_PERMISSION_NAMES.length).toBeGreaterThan(20);
  });

  it('sends each role to its own home', () => {
    expect(adminHomeFor('SALES_REP')).toBe('/sales');
    expect(adminHomeFor('SUPPORT')).toBe('/admin');
  });
});

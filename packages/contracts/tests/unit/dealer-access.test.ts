import { describe, expect, it } from 'vitest';

import {
  ASSIGNABLE_DEALER_ROLES,
  DEALER_PERMISSION_NAMES,
  DEALER_PERMISSIONS,
  DEALER_ROLE_LABELS,
  canDealer,
  dealerPermissionsFor,
  enquiryTransitionPermission,
  type DealerPermission,
} from '../../src/dealer-access.js';
import { DealerRole, EnquiryStatus } from '../../src/enums.js';

/**
 * The V1 launch matrix (R92), asserted row by row. The negative rows matter
 * most: a permission wrongly given to STAFF is a privilege escalation no
 * route-level test would notice.
 */
const MATRIX: [DealerPermission, boolean, boolean, boolean][] = [
  ['vehicle:read', true, true, true],
  ['vehicle:write', true, true, true],
  ['listing:submit', true, true, false],
  ['listing:reserve', true, true, false],
  ['listing:sell', true, true, false],
  ['listing:withdraw', true, true, false],
  ['listing:reactivate', true, true, false],
  ['enquiry:read', true, true, true],
  ['enquiry:contact', true, true, true],
  ['enquiry:close', true, true, false],
  ['dealer:update', true, false, false],
  ['document:upload', true, false, false],
  ['member:manage', true, false, false],
];

describe('DEALER_PERMISSIONS', () => {
  it.each(MATRIX)('%s — OWNER %s, MANAGER %s, STAFF %s', (permission, owner, manager, staff) => {
    expect(dealerPermissionsFor('OWNER').includes(permission)).toBe(owner);
    expect(dealerPermissionsFor('MANAGER').includes(permission)).toBe(manager);
    expect(dealerPermissionsFor('STAFF').includes(permission)).toBe(staff);
  });

  it('gives OWNER every permission', () => {
    expect([...dealerPermissionsFor('OWNER')].sort()).toEqual([...DEALER_PERMISSION_NAMES].sort());
  });

  it('is a strict hierarchy — OWNER ⊇ MANAGER ⊇ STAFF', () => {
    const owner = new Set(dealerPermissionsFor('OWNER'));
    const manager = new Set(dealerPermissionsFor('MANAGER'));
    expect(dealerPermissionsFor('MANAGER').every((p) => owner.has(p))).toBe(true);
    expect(dealerPermissionsFor('STAFF').every((p) => manager.has(p))).toBe(true);
  });

  it('names only roles that exist', () => {
    for (const roles of Object.values(DEALER_PERMISSIONS)) {
      for (const role of roles) expect(DealerRole.options).toContain(role);
    }
  });
});

describe('canDealer', () => {
  it('answers from the granted list', () => {
    expect(canDealer(['enquiry:contact'], 'enquiry:contact')).toBe(true);
    expect(canDealer(['enquiry:contact'], 'enquiry:close')).toBe(false);
  });

  it('says no to a missing list', () => {
    expect(canDealer(null, 'vehicle:read')).toBe(false);
    expect(canDealer(undefined, 'vehicle:read')).toBe(false);
  });
});

describe('enquiryTransitionPermission', () => {
  it('lets anyone who works leads mark a new one contacted', () => {
    expect(enquiryTransitionPermission('NEW', 'CONTACTED')).toBe('enquiry:contact');
    expect(enquiryTransitionPermission('CONTACTED', 'CONTACTED')).toBe('enquiry:contact');
  });

  it.each([
    ['NEW', 'CLOSED'],
    ['CONTACTED', 'CLOSED'],
    ['NEW', 'SPAM'],
    ['CLOSED', 'NEW'],
    ['CLOSED', 'CONTACTED'],
    ['SPAM', 'CONTACTED'],
  ] as const)('needs enquiry:close for %s → %s', (from, to) => {
    expect(enquiryTransitionPermission(from, to)).toBe('enquiry:close');
  });

  it('is defined for every pair of statuses', () => {
    for (const from of EnquiryStatus.options) {
      for (const to of EnquiryStatus.options) {
        expect(DEALER_PERMISSION_NAMES).toContain(enquiryTransitionPermission(from, to));
      }
    }
  });
});

describe('roles', () => {
  it('lets an owner hand out MANAGER and STAFF, never OWNER', () => {
    expect(ASSIGNABLE_DEALER_ROLES).toEqual(['MANAGER', 'STAFF']);
  });

  it('labels every role', () => {
    for (const role of DealerRole.options) expect(DEALER_ROLE_LABELS[role]).toBeTruthy();
  });
});

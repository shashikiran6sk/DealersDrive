import { describe, expect, it } from 'vitest';

import { AdminCallLeadQuery, CallLeadQuery } from '../../src/call-lead.js';

describe('call lead queries', () => {
  it('defaults the page size and caps it', () => {
    expect(CallLeadQuery.parse({})).toEqual({ limit: 25 });
    expect(CallLeadQuery.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('refuses a dealerId, so a dealership can only read its own leads', () => {
    expect(CallLeadQuery.safeParse({ dealerId: 'x' }).success).toBe(false);
  });

  it('lets admins narrow to one dealership by slug, and nothing else unknown', () => {
    expect(AdminCallLeadQuery.parse({ dealer: ' sri-lakshmi-motors ' }).dealer).toBe(
      'sri-lakshmi-motors',
    );
    expect(AdminCallLeadQuery.safeParse({ status: 'NEW' }).success).toBe(false);
  });
});

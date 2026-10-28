import { describe, expect, it } from 'vitest';

import {
  toAdminCallLead,
  toCallLead,
  type CallLeadRow,
} from '../../../../src/modules/enquiries/call-leads.mapper.js';

const NOW = new Date('2026-10-28T12:00:00.000Z');

function row(overrides: Partial<CallLeadRow> = {}): CallLeadRow {
  return {
    id: '7d1e2f3a-4b5c-4d6e-8f70-81a2b3c4d5e6',
    firstRevealedAt: new Date('2026-10-26T09:00:00.000Z'),
    lastRevealedAt: new Date('2026-10-28T10:00:00.000Z'),
    revealCount: 2,
    customer: { fullName: 'Ravi Kumar', phone: '+919840012345' },
    dealer: { brandName: 'Sri Lakshmi Motors', slug: 'sri-lakshmi-motors', status: 'ACTIVE' },
    listing: {
      status: 'ACTIVE',
      slug: 'hyundai-creta-2023',
      vehicle: {
        manufacturingYear: 2023,
        make: 'Hyundai',
        model: 'Creta',
        variant: 'SX(O)',
        registrationNumber: 'TN01AB1234',
      },
    },
    ...overrides,
  };
}

describe('toCallLead', () => {
  it('shows the customer with a call link and the car with its public page', () => {
    const lead = toCallLead(row(), NOW);
    expect(lead.customer).toEqual({
      name: 'Ravi Kumar',
      initials: 'RK',
      phoneDisplay: '+91 98400 12345',
      callHref: 'tel:+919840012345',
    });
    expect(lead.vehicle.href).toBe('/car/hyundai-creta-2023');
    expect(lead.revealCount).toBe(2);
    expect(lead.lastRevealedAt).toBe('2026-10-28T10:00:00.000Z');
  });

  it('has no call link for a released number, and a placeholder for a missing name', () => {
    const lead = toCallLead(row({ customer: { fullName: '  ', phone: null } }), NOW);
    expect(lead.customer.phoneDisplay).toBeNull();
    expect(lead.customer.callHref).toBeNull();
    expect(lead.customer.name).not.toBe('');
  });

  it('drops the public link once the car or the dealership is off the marketplace', () => {
    const sold = row();
    sold.listing.status = 'SOLD';
    expect(toCallLead(sold, NOW).vehicle.href).toBeNull();
    const suspended = row();
    suspended.dealer.status = 'SUSPENDED';
    expect(toCallLead(suspended, NOW).vehicle.href).toBeNull();
  });

  it('names the dealership for admins', () => {
    expect(toAdminCallLead(row(), NOW).dealer).toEqual({
      name: 'Sri Lakshmi Motors',
      slug: 'sri-lakshmi-motors',
    });
  });
});

import type { DealerInventoryRow, SalesVehiclesResponse } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SalesVehicleList } from '@/features/sales/sales-vehicle-list';

const DEALER = '44444444-4444-4444-8444-444444444444';

function row(overrides: Partial<DealerInventoryRow> = {}): DealerInventoryRow {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    title: '2021 Hyundai Creta SX',
    registrationDisplay: 'UP 32 SR 1001',
    summary: 'Petrol · Manual',
    priceLabel: '₹9,50,000',
    status: 'DRAFT',
    statusLabel: 'Draft',
    statusTone: 'neutral',
    reason: null,
    complete: false,
    slug: null,
    actions: [],
    reactivationPending: false,
    updatedAt: '2026-10-06T10:00:00.000Z',
    updatedLabel: 'today',
    ...overrides,
  };
}

function listings(overrides: Partial<SalesVehiclesResponse> = {}): SalesVehiclesResponse {
  return { dealerApproved: true, canCreate: true, data: [row()], ...overrides };
}

describe('SalesVehicleList', () => {
  it('links each prepared listing to its Sales edit page, and offers a new one', () => {
    render(<SalesVehicleList dealerId={DEALER} listings={listings()} />);
    expect(screen.getByRole('link', { name: '2021 Hyundai Creta SX' })).toHaveAttribute(
      'href',
      `/sales/dealers/${DEALER}/vehicles/22222222-2222-4222-8222-222222222222/edit?step=review`,
    );
    expect(screen.getByRole('link', { name: 'Start a listing' })).toHaveAttribute(
      'href',
      `/sales/dealers/${DEALER}/vehicles/new`,
    );
  });

  it('says drafts wait for approval, and shows a reviewer’s reason', () => {
    render(
      <SalesVehicleList
        dealerId={DEALER}
        listings={listings({
          dealerApproved: false,
          data: [row({ status: 'CHANGES_REQUESTED', reason: 'Add the service history.' })],
        })}
      />,
    );
    expect(screen.getByText(/once the dealership is approved/)).toBeInTheDocument();
    expect(screen.getByText('Add the service history.')).toBeInTheDocument();
  });

  it('offers nothing new for a closed dealership, and says when there is nothing', () => {
    render(
      <SalesVehicleList dealerId={DEALER} listings={listings({ canCreate: false, data: [] })} />,
    );
    expect(screen.getByText(/suspended, rejected or closed/)).toBeInTheDocument();
    expect(screen.getByText(/No listings yet/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Start a listing' })).toBeNull();
  });
});

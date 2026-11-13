import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/dealer/billing/billing-actions', () => ({
  createCreditOrderAction: vi.fn(),
  verifyCreditOrderAction: vi.fn(),
}));

import { CreditLedger, CreditPacks } from '@/features/dealer/billing';

const PACKS = {
  data: [
    {
      id: 'pack-5',
      credits: 5,
      pricePaise: 225_000,
      priceLabel: '₹2,250',
      totalPaise: 265_500,
      totalLabel: '₹2,655',
      perCreditLabel: '₹450 per credit',
      savingsLabel: 'Save 10%',
    },
  ],
  gstPercent: 18,
  taxNote: 'Prices are before 18% GST, which is added at checkout.',
  purchasable: true,
};

describe('credit packs', () => {
  it('shows each pack with its GST-inclusive total and saving', () => {
    render(<CreditPacks packs={PACKS} canPurchase />);
    expect(screen.getByText('₹2,655 incl. GST')).toBeInTheDocument();
    expect(screen.getByText('Save 10%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy' })).toBeEnabled();
  });

  it('keeps buying to the owner', () => {
    render(<CreditPacks packs={PACKS} canPurchase={false} />);
    expect(screen.getByText('Only the dealership owner can buy credits.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy' })).toBeDisabled();
  });

  it('says so when no gateway is configured', () => {
    render(<CreditPacks packs={{ ...PACKS, purchasable: false }} canPurchase />);
    expect(screen.getByText(/not switched on yet/)).toBeInTheDocument();
  });
});

describe('the credit ledger', () => {
  it('reads as what moved and what was left', () => {
    render(
      <CreditLedger
        entries={[
          {
            id: '2',
            reason: 'HOLD_SUBMIT',
            label: 'Held for a listing in review',
            delta: 0,
            heldDelta: 1,
            changeLabel: '1 held',
            tone: 'warn',
            balanceAfter: 5,
            availableAfter: 4,
            listingId: null,
            orderId: null,
            note: null,
            createdAt: '2026-11-11T09:00:00.000Z',
            dateLabel: '11 Nov 2026',
          },
        ]}
      />,
    );
    expect(screen.getByText('1 held')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});

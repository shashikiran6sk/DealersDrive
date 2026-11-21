import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/dealer/billing/billing-actions', () => ({
  createCreditOrderAction: vi.fn(),
  verifyCreditOrderAction: vi.fn(),
}));

import CreditsPolicyPage, {
  generateMetadata as creditsPolicyMetadata,
} from '@/app/(public)/credits-and-refunds/page';
import { CREDITS_POLICY, CreditLedger, CreditOrders, CreditPacks } from '@/features/dealer/billing';
import { PhotoPlanChoice } from '@/features/vehicle/photo-step';

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

  it('shows no GST at all while none is charged', () => {
    render(
      <CreditPacks
        packs={{
          ...PACKS,
          data: PACKS.data.map((pack) => ({
            ...pack,
            totalPaise: pack.pricePaise,
            totalLabel: pack.priceLabel,
          })),
          gstPercent: 0,
          taxNote: 'Prices are final — no GST is charged.',
        }}
        canPurchase
      />,
    );
    expect(screen.getByText('₹2,250')).toBeInTheDocument();
    expect(screen.queryByText(/incl\. GST/)).not.toBeInTheDocument();
    expect(screen.getByText('Prices are final — no GST is charged.')).toBeInTheDocument();
  });

  it('says before payment that a pack is one-off, never expires and is not refundable', () => {
    render(<CreditPacks packs={PACKS} canPurchase />);
    expect(screen.getByText(/One-time purchase, not a subscription/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Credits and refunds policy' })).toHaveAttribute(
      'href',
      '/credits-and-refunds',
    );
    expect(screen.getByText(/Money taken but no credits\?/)).toBeInTheDocument();
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
    const table = within(screen.getByRole('table'));
    expect(table.getByText('1 held')).toBeInTheDocument();
    expect(table.getByText('4')).toBeInTheDocument();

    const phone = within(screen.getByRole('list', { name: 'Credit history' }));
    expect(phone.getByText('Held for a listing in review')).toBeInTheDocument();
    expect(phone.getByText('1 held')).toBeInTheDocument();
    expect(phone.getByText('11 Nov 2026 · 4 available after')).toBeInTheDocument();
  });
});

describe('payments a dealer can quote', () => {
  it('shows the Razorpay payment id of a paid order', () => {
    render(
      <CreditOrders
        orders={[
          {
            id: '22222222-2222-4222-8222-222222222222',
            credits: 5,
            totalPaise: 265_500,
            totalLabel: '₹2,655',
            status: 'PAID',
            statusLabel: 'Paid',
            statusTone: 'ok',
            failureReason: null,
            createdAt: '2026-11-09T09:00:00.000Z',
            dateLabel: '09 Nov 2026',
            paidAt: '2026-11-09T09:01:00.000Z',
            gatewayOrderId: 'order_1',
            gatewayPaymentId: 'pay_1',
          },
        ]}
      />,
    );
    expect(within(screen.getByRole('table')).getByText('Payment ID: pay_1')).toBeInTheDocument();

    const phone = within(screen.getByRole('list', { name: 'Payments' }));
    expect(phone.getByText('5 credits · ₹2,655')).toBeInTheDocument();
    expect(phone.getByText('Paid')).toBeInTheDocument();
    expect(phone.getByText('Payment ID: pay_1')).toBeInTheDocument();
  });
});

describe('the credits and refunds policy', () => {
  it('is published beside the terms, saying credits never expire and are not refundable', () => {
    vi.stubEnv('APP_ENV', 'local');
    render(CreditsPolicyPage());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(CREDITS_POLICY.title);
    expect(screen.getByText(/They do not expire/)).toBeInTheDocument();
    expect(screen.getByText(/Bought credits are not refundable/)).toBeInTheDocument();
    expect(creditsPolicyMetadata().alternates?.canonical).toMatch(/\/credits-and-refunds$/);
    vi.unstubAllEnvs();
  });
});

describe('the credit price on the photo-plan cards', () => {
  const options = [
    {
      plan: 'DEALER' as const,
      title: 'Upload the photos yourself',
      body: 'Body',
      note: null,
      available: true,
      credits: 1,
    },
  ];

  it('adds GST only when GST is charged', () => {
    const { rerender } = render(
      <PhotoPlanChoice options={options} selected={null} creditPrice="₹500" onChoose={() => {}} />,
    );
    expect(screen.getByText('1 credit = ₹500')).toBeInTheDocument();

    rerender(
      <PhotoPlanChoice
        options={options}
        selected={null}
        creditPrice="₹500"
        gstPercent={18}
        onChoose={() => {}}
      />,
    );
    expect(screen.getByText('1 credit = ₹500 + GST')).toBeInTheDocument();
  });
});

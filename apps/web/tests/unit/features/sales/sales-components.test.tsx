import type { DealerOnboardingProvenance, SalesDealerSummary } from '@dealers-drive/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OnboardingProvenance } from '@/features/admin/onboarding-provenance';
import { submitAssistedDealerAction } from '@/features/sales/sales-actions';
import { SalesDealerList } from '@/features/sales/sales-dealer-list';
import { SubmitAssistedDealer } from '@/features/sales/submit-assisted-dealer';

vi.mock('@/features/sales/sales-actions', () => ({
  submitAssistedDealerAction: vi.fn(() => Promise.resolve({ ok: true })),
}));

function summary(overrides: Partial<SalesDealerSummary> = {}): SalesDealerSummary {
  return {
    id: 'd-1',
    legalName: 'Sri Murugan Cars',
    city: 'Katpadi',
    district: 'Vellore',
    status: 'DRAFT',
    statusLabel: 'Draft',
    statusTone: 'neutral',
    statusReason: null,
    contactName: 'Murugan',
    phoneDisplay: '+91 98400 12345',
    phoneVerified: true,
    emailVerified: false,
    claimed: false,
    createdAt: '2026-10-06T10:00:00.000Z',
    listings: { draft: 2, review: 1, live: 0 },
    ...overrides,
  };
}

describe('SalesDealerList', () => {
  it('shows each dealership with its verification state in words', () => {
    render(<SalesDealerList dealers={[summary()]} emptyLabel="None" />);
    expect(screen.getByRole('link', { name: /Sri Murugan Cars/ })).toHaveAttribute(
      'href',
      '/sales/dealers/d-1',
    );
    expect(screen.getByText('Phone verified')).toBeInTheDocument();
    expect(screen.getByText('Email pending verification')).toBeInTheDocument();
    expect(screen.getByText('0 live · 1 in review · 2 drafts')).toBeInTheDocument();
  });

  it('says so when there is nothing', () => {
    render(<SalesDealerList dealers={[]} emptyLabel="No dealerships yet." />);
    expect(screen.getByText('No dealerships yet.')).toBeInTheDocument();
  });
});

describe('SubmitAssistedDealer', () => {
  it('names what is missing and will not submit an incomplete application', () => {
    render(<SubmitAssistedDealer dealerId="d-1" canSubmit={false} missing={['Documents']} />);
    expect(screen.getByText('Still missing: Documents')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit for verification' })).toBeDisabled();
  });

  it('submits once and confirms', async () => {
    const user = userEvent.setup();
    render(<SubmitAssistedDealer dealerId="d-1" canSubmit missing={[]} />);
    await user.click(screen.getByRole('button', { name: 'Submit for verification' }));
    await waitFor(() => {
      expect(submitAssistedDealerAction).toHaveBeenCalledWith('d-1');
    });
    expect(await screen.findByText(/Our operations team will review it/)).toBeInTheDocument();
  });
});

describe('OnboardingProvenance', () => {
  const ASSISTED: DealerOnboardingProvenance = {
    source: 'ASSISTED',
    sourceLabel: 'Assisted by Sales',
    assistedBy: { name: 'Arun', email: 'arun@dealers-drive.in' },
    phoneVerified: true,
    phoneLabel: 'Verified',
    emailVerified: false,
    emailLabel: 'Pending verification',
    claimed: false,
    reviewerIsAssistant: false,
  };

  it('tells the reviewer who assisted, and what is and is not verified', () => {
    render(<OnboardingProvenance onboarding={ASSISTED} />);
    expect(screen.getByText('Assisted by Sales')).toBeInTheDocument();
    expect(screen.getByText(/arun@dealers-drive.in/)).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Pending verification')).toBeInTheDocument();
    expect(screen.getByText('Not claimed yet')).toBeInTheDocument();
  });

  it('warns a reviewer who assisted that they may not decide', () => {
    render(<OnboardingProvenance onboarding={{ ...ASSISTED, reviewerIsAssistant: true }} />);
    expect(screen.getByText(/another reviewer has to make its decisions/)).toBeInTheDocument();
  });

  it('shows a self-onboarded dealership without assistant rows', () => {
    render(
      <OnboardingProvenance
        onboarding={{
          ...ASSISTED,
          source: 'SELF',
          sourceLabel: 'Self-onboarded',
          assistedBy: null,
          emailVerified: true,
          emailLabel: 'Verified',
        }}
      />,
    );
    expect(screen.queryByText('Sales representative')).not.toBeInTheDocument();
    expect(screen.queryByText('Owner account')).not.toBeInTheDocument();
  });
});

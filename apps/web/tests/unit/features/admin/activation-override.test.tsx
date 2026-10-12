import {
  MANUAL_ACTIVATION_DISCLAIMER,
  MANUAL_ACTIVATION_DISCLAIMER_VERSION,
  type AdminDealerDetail,
} from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DealerAdminActions } from '@/features/admin/dealer-actions';
import { ManualActivationNotice } from '@/features/admin/manual-activation-notice';

const overrideActivationAction = vi.fn();
const revokeActivationOverrideAction = vi.fn();
vi.mock('@/features/admin/actions', () => ({
  approveDealerAction: vi.fn(),
  closeDealerAction: vi.fn(),
  reinstateDealerAction: vi.fn(),
  rejectDealerAction: vi.fn(),
  requestDealerChangesAction: vi.fn(),
  suspendDealerAction: vi.fn(),
  overrideActivationAction: (...args: unknown[]) => overrideActivationAction(...args) as unknown,
  revokeActivationOverrideAction: (...args: unknown[]) =>
    revokeActivationOverrideAction(...args) as unknown,
}));

const JUSTIFICATION =
  'Field team met the owner at the yard; policy exception OPS-2026-114 approved.';

// Only the moderation controls' inputs; other detail fields are never read here.
const DEALER = {
  id: '3c8f2b10-2222-4000-8000-000000000002',
  slug: 'chennai-cars',
  brandName: 'Chennai cars',
  status: 'PENDING_APPROVAL',
  gstin: '33AABCS1429B1ZX',
  documents: [],
  activation: {
    method: null,
    methodLabel: null,
    overriddenAt: null,
    overriddenBy: null,
    justification: null,
    outstanding: ['PERSONAL_IDENTITY', 'BUSINESS_IDENTITY'],
  },
  documentGaps: ['PERSONAL_IDENTITY', 'BUSINESS_IDENTITY'],
  actions: {
    canApprove: false,
    canOverrideActivation: true,
    overrideBlockedReason: null,
    canRevokeOverride: false,
  },
} as unknown as AdminDealerDetail;

function withActions(
  actions: Partial<AdminDealerDetail['actions']>,
  rest: Partial<AdminDealerDetail> = {},
): AdminDealerDetail {
  return { ...DEALER, ...rest, actions: { ...DEALER.actions, ...actions } };
}

/**
 * #299 — the controlled exception to standard approval. Super admin only (the
 * API decides, through `canOverrideActivation`), a justification of at least
 * forty characters, and the disclaimer shown verbatim and ticked. It never
 * verifies a document.
 */
describe('manual activation', () => {
  beforeEach(() => overrideActivationAction.mockReset().mockResolvedValue({ ok: true }));

  it('shows the disclaimer verbatim and says it never verifies anything', () => {
    render(<DealerAdminActions dealer={DEALER} />);

    expect(screen.getByText(MANUAL_ACTIVATION_DISCLAIMER)).toBeInTheDocument();
    expect(
      screen.getByText(/never marks a document verified and never grants the Dealer Verified/),
    ).toBeInTheDocument();
  });

  it('needs the disclaimer ticked and a long enough justification', async () => {
    const user = userEvent.setup();
    render(<DealerAdminActions dealer={DEALER} />);
    const button = screen.getByRole('button', { name: 'Activate manually' });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText(/^Justification/), 'Too short to justify anything.');
    await user.click(screen.getByRole('checkbox'));
    expect(button).toBeDisabled();

    await user.clear(screen.getByLabelText(/^Justification/));
    await user.type(screen.getByLabelText(/^Justification/), JUSTIFICATION);
    await user.click(screen.getByRole('checkbox'));
    expect(button).toBeDisabled();

    await user.click(screen.getByRole('checkbox'));
    expect(button).toBeEnabled();
    await user.click(button);

    expect(overrideActivationAction).toHaveBeenCalledWith(
      DEALER.id,
      {
        justification: JUSTIFICATION,
        acknowledgedDisclaimer: MANUAL_ACTIVATION_DISCLAIMER_VERSION,
      },
      DEALER.slug,
    );
    expect(
      await screen.findByText('Dealership activated manually. Its documents remain unverified.'),
    ).toBeInTheDocument();
  });

  /** L7: no GSTIN on file asks for nothing more, and sends no GST note. */
  it('asks for no GST review when no GSTIN is on file, and sends none', async () => {
    const user = userEvent.setup();
    render(<DealerAdminActions dealer={withActions({}, { gstin: null })} />);
    const button = screen.getByRole('button', { name: 'Activate manually' });
    expect(screen.queryByLabelText(/GST/)).toBeNull();

    await user.type(screen.getByLabelText(/^Justification/), JUSTIFICATION);
    await user.click(screen.getByRole('checkbox'));
    expect(button).toBeEnabled();
    await user.click(button);

    expect(overrideActivationAction).toHaveBeenCalledWith(
      DEALER.id,
      {
        justification: JUSTIFICATION,
        acknowledgedDisclaimer: MANUAL_ACTIVATION_DISCLAIMER_VERSION,
      },
      DEALER.slug,
    );
  });

  it('shows why it is blocked instead of the form', () => {
    render(
      <DealerAdminActions
        dealer={withActions({
          canOverrideActivation: false,
          overrideBlockedReason:
            'A reviewer rejected a submitted document. Resolve the rejection before activating.',
        })}
      />,
    );

    expect(
      screen.getByText(/A reviewer rejected a submitted document\. Resolve the rejection/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activate manually' })).toBeNull();
    expect(screen.queryByText(MANUAL_ACTIVATION_DISCLAIMER)).toBeNull();
  });

  it('is not offered to an admin the API does not offer it to', () => {
    render(
      <DealerAdminActions
        dealer={withActions({ canOverrideActivation: false, overrideBlockedReason: null })}
      />,
    );

    expect(screen.queryByText(/Manual activation/)).toBeNull();
  });

  it('is not offered on an active dealership', () => {
    render(
      <DealerAdminActions
        dealer={withActions(
          {
            canOverrideActivation: false,
            overrideBlockedReason: 'Only an application awaiting activation can be activated.',
          },
          { status: 'ACTIVE' },
        )}
      />,
    );

    expect(screen.queryByText(/Only an application awaiting activation/)).toBeNull();
  });
});

describe('withdrawing a manual activation', () => {
  beforeEach(() => revokeActivationOverrideAction.mockReset().mockResolvedValue({ ok: true }));

  it('needs a reason of at least twenty characters', async () => {
    const user = userEvent.setup();
    render(
      <DealerAdminActions
        dealer={withActions(
          { canOverrideActivation: false, canRevokeOverride: true },
          { status: 'ACTIVE' },
        )}
      />,
    );
    const button = screen.getByRole('button', { name: 'Withdraw manual activation' });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText(/Reason for withdrawing/), 'Too short.');
    expect(button).toBeDisabled();

    await user.clear(screen.getByLabelText(/Reason for withdrawing/));
    await user.type(
      screen.getByLabelText(/Reason for withdrawing/),
      'Policy exception was withdrawn by compliance.',
    );
    await user.click(button);

    expect(revokeActivationOverrideAction).toHaveBeenCalledWith(
      DEALER.id,
      { reason: 'Policy exception was withdrawn by compliance.' },
      DEALER.slug,
    );
  });
});

describe('the manual activation warning on the dealer page', () => {
  it('names the method, who and when, the justification and what is outstanding', () => {
    render(
      <ManualActivationNotice
        activation={{
          method: 'MANUAL_OVERRIDE',
          methodLabel: 'Manual activation — documents not verified',
          overriddenAt: '2026-10-10T06:30:00.000Z',
          overriddenBy: 'superadmin@dealersdrive.in',
          justification: JUSTIFICATION,
          outstanding: ['BUSINESS_IDENTITY'],
        }}
      />,
    );

    expect(screen.getByText('Manual activation — documents not verified')).toBeInTheDocument();
    expect(
      screen.getByText(/Activated manually by superadmin@dealersdrive\.in/),
    ).toBeInTheDocument();
    expect(screen.getByText(JUSTIFICATION)).toBeInTheDocument();
    expect(screen.getByText('Business Identity Proof')).toBeInTheDocument();
    expect(screen.getByText(/does not grant the Dealer Verified badge/)).toBeInTheDocument();
  });

  it('renders nothing for a standard approval', () => {
    const { container } = render(
      <ManualActivationNotice
        activation={{
          method: 'STANDARD',
          methodLabel: 'Standard approval',
          overriddenAt: null,
          overriddenBy: null,
          justification: null,
          outstanding: [],
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

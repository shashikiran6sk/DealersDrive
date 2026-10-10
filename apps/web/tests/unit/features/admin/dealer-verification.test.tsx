import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DealerVerificationReview } from '@dealers-drive/contracts';
import { DealerVerificationReviewPanel } from '@/features/admin/dealer-verification/dealer-verification';
import { decideDealerVerification } from '@/features/admin/dealer-verification/actions';
import type * as Api from '@/lib/api';
const send = vi.fn();
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof Api>()),
  apiSend: (...args: unknown[]) => send(...args) as unknown,
}));
const id = '11111111-1111-4111-8111-111111111111';
const initial: DealerVerificationReview = {
  dealerId: id,
  status: 'NOT_VERIFIED',
  statusLabel: 'Not verified',
  version: 0,
  verifiedAt: null,
  reviewerId: null,
  transitions: ['PENDING', 'IN_REVIEW'],
  history: [],
};
beforeEach(() => {
  send.mockReset();
});
describe('genuine admin verification workflow', () => {
  it('records a review decision and keeps saved status through a stale refresh', async () => {
    const review = {
      ...initial,
      status: 'IN_REVIEW',
      statusLabel: 'Verification in review',
      version: 1,
      transitions: ['VERIFIED', 'REJECTED'],
    } as const;
    send.mockResolvedValue(review);
    const user = userEvent.setup();
    const view = render(<DealerVerificationReviewPanel initial={initial} />);
    await user.selectOptions(screen.getByLabelText('Next verification status'), 'IN_REVIEW');
    await user.click(screen.getByRole('button', { name: 'Save verification decision' }));
    expect(
      await screen.findByText('Verification in review', { selector: 'p' }),
    ).toBeInTheDocument();
    expect(send).toHaveBeenCalledWith('POST', `/v1/admin/dealers/${id}/verification`, {
      expectedVersion: 0,
      status: 'IN_REVIEW',
    });
    view.rerender(<DealerVerificationReviewPanel initial={initial} />);
    expect(screen.getByText('Verification in review', { selector: 'p' })).toBeInTheDocument();
    view.rerender(
      <DealerVerificationReviewPanel
        initial={{ ...initial, dealerId: '22222222-2222-4222-8222-222222222222' }}
      />,
    );
    expect(screen.getByText('Not verified', { selector: 'p' })).toBeInTheDocument();
  });
  it('requires performed evidence and separates legal applicability from yard photos', () => {
    render(
      <DealerVerificationReviewPanel
        initial={{
          ...initial,
          status: 'IN_REVIEW',
          statusLabel: 'Verification in review',
          transitions: ['VERIFIED', 'REJECTED'],
        }}
      />,
    );
    expect(
      screen.getByRole('group', { name: 'Record checks actually performed' }),
    ).toBeInTheDocument();
    for (const name of [
      'Representative identity evidence',
      'Authority to represent the business',
      'Business existence evidence',
      'Contact validation evidence',
      'Business classification and legal review reference',
      'Applicable authorization check or reviewed non-applicability',
      'GST registration check or reviewed non-requirement',
    ])
      expect(screen.getByLabelText(name)).toBeRequired();
    expect(screen.getByText(/Yard ownership and photos are optional/)).toBeInTheDocument();
    expect(
      screen.getByText(/Unresolved legal applicability must remain in review/),
    ).toBeInTheDocument();
  });
  it('shows API refusal and does not invent a successful decision', async () => {
    send.mockRejectedValue(new TypeError('unavailable'));
    const user = userEvent.setup();
    render(<DealerVerificationReviewPanel initial={initial} />);
    await user.click(screen.getByRole('button', { name: 'Save verification decision' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable');
    expect(screen.getByText('Not verified', { selector: 'p' })).toBeInTheDocument();
  });
  it('requires a reason for revocation and renders restricted decision history as text', () => {
    const review: DealerVerificationReview = {
      ...initial,
      status: 'VERIFIED',
      statusLabel: 'Dealer Verified',
      version: 2,
      reviewerId: id,
      verifiedAt: '2026-10-10T10:00:00Z',
      transitions: ['REVOKED'],
      history: [
        {
          id: '12',
          at: '2026-10-10T10:00:00Z',
          actorId: id,
          from: 'IN_REVIEW',
          to: 'VERIFIED',
          reason: '<script>synthetic unsafe text</script>',
          assessment: null,
        },
      ],
    };
    render(<DealerVerificationReviewPanel initial={review} />);
    expect(screen.getByLabelText('Decision reason')).toBeRequired();
    expect(screen.getByText('<script>synthetic unsafe text</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
  });
  it('validates forged or incomplete decisions before calling the API', async () => {
    expect(
      (await decideDealerVerification(id, { expectedVersion: 0, status: 'VERIFIED' })).ok,
    ).toBe(false);
    expect(
      (await decideDealerVerification('wrong', { expectedVersion: 0, status: 'IN_REVIEW' })).ok,
    ).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});

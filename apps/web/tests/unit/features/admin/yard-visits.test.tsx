import type { YardVisitDto } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { YardVisitsPanel } from '@/features/admin/yard-visits';

const recordYardVisitAction = vi.fn();
vi.mock('@/features/admin/actions', () => ({
  recordYardVisitAction: (...args: unknown[]) => recordYardVisitAction(...args) as unknown,
}));

const DEALER_ID = '3c8f2b10-2222-4000-8000-000000000002';

const CONFIRMED: YardVisitDto = {
  id: '5a1d0c33-1111-4000-8000-000000000001',
  visitedOn: '2026-10-08',
  outcome: 'YARD_CONFIRMED',
  outcomeLabel: 'Yard seen at the address',
  notes: 'Twelve cars on the forecourt; owner present.',
  recordedBy: 'field@dealersdrive.in',
  recordedAt: '2026-10-08T11:00:00.000Z',
  photos: [
    {
      mediaId: '5a1d0c33-1111-4000-8000-0000000000a1',
      url: 'https://storage.test/signed/visit-1.jpg',
      expiresAt: '2026-10-08T11:15:00.000Z',
    },
  ],
};

const NO_YARD: YardVisitDto = {
  ...CONFIRMED,
  id: '5a1d0c33-1111-4000-8000-000000000002',
  visitedOn: '2026-09-20',
  outcome: 'NO_PHYSICAL_YARD',
  outcomeLabel: 'Trades without a physical yard',
  notes: null,
  photos: [],
};

/**
 * #299 — internal yard visits are private staff evidence: never public, never
 * required, not a route to Dealer Verified. A dealership without a yard is
 * recorded as such and is not penalised.
 */
describe('the internal yard visits panel', () => {
  beforeEach(() => recordYardVisitAction.mockReset().mockResolvedValue({ ok: true }));

  it('renders nothing when the admin may not see visits', () => {
    const { container } = render(<YardVisitsPanel dealerId={DEALER_ID} visits={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('lists each visit with its outcome, notes, recorder and photographs', () => {
    render(<YardVisitsPanel dealerId={DEALER_ID} visits={[CONFIRMED, NO_YARD]} />);
    const list = within(screen.getByRole('list'));

    expect(list.getByText('Yard seen at the address')).toBeInTheDocument();
    expect(list.getByText('Trades without a physical yard')).toBeInTheDocument();
    expect(screen.getByText('Twelve cars on the forecourt; owner present.')).toBeInTheDocument();
    expect(screen.getAllByText(/Recorded by field@dealersdrive\.in/)).toHaveLength(2);
    expect(screen.getByRole('img', { name: /Yard visit photograph 1/ })).toHaveAttribute(
      'src',
      CONFIRMED.photos[0]?.url,
    );
  });

  it('says that trading without a yard is not a penalty, and that visits are private', () => {
    render(<YardVisitsPanel dealerId={DEALER_ID} visits={[NO_YARD]} />);

    expect(screen.getByText('Recorded as found — not a penalty.')).toBeInTheDocument();
    expect(screen.getByText(/It is not a penalty/)).toBeInTheDocument();
    expect(screen.getByText(/Never shown to buyers or to the dealer/)).toBeInTheDocument();
    expect(screen.getByText(/not a route to Dealer Verified/)).toBeInTheDocument();
  });

  it('says when nothing has been recorded', () => {
    render(<YardVisitsPanel dealerId={DEALER_ID} visits={[]} />);

    expect(screen.getByText('No visits recorded.')).toBeInTheDocument();
  });

  it('records a visit with a date and an outcome', async () => {
    const user = userEvent.setup();
    render(<YardVisitsPanel dealerId={DEALER_ID} visits={[]} />);
    const button = screen.getByRole('button', { name: 'Record visit' });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText('Visited on'), '2026-10-01');
    await user.selectOptions(screen.getByLabelText('What was found'), 'NO_PHYSICAL_YARD');
    await user.type(screen.getByLabelText('Notes'), 'Works from a rented office.');
    expect(button).toBeEnabled();
    await user.click(button);

    expect(recordYardVisitAction).toHaveBeenCalledWith(DEALER_ID, {
      visitedOn: '2026-10-01',
      outcome: 'NO_PHYSICAL_YARD',
      notes: 'Works from a rented office.',
    });
    expect(await screen.findByText('Visit recorded.')).toBeInTheDocument();
  });

  it('refuses a visit in the future', async () => {
    const user = userEvent.setup();
    render(<YardVisitsPanel dealerId={DEALER_ID} visits={[]} />);

    await user.type(screen.getByLabelText('Visited on'), '2999-01-01');

    expect(screen.getByRole('button', { name: 'Record visit' })).toBeDisabled();
  });
});

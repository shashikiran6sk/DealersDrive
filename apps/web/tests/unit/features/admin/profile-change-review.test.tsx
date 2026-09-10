import type { AdminProfileChange } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfileChangeReview } from '@/features/admin/profile-change-review';

/**
 * R34 — the card a moderator decides on a dealer's own words from.
 *
 * What is asserted is what the card has to get right for the decision to be a
 * real one: that the live value is on screen beside the proposal, that a field
 * the request does not touch reads as *unchanged* rather than as cleared, and
 * that a refusal cannot leave without a sentence attached.
 */
const approveProfileChangeAction = vi.fn();
const rejectProfileChangeAction = vi.fn();

vi.mock('@/features/admin/actions', () => ({
  approveProfileChangeAction: (id: string) => approveProfileChangeAction(id) as unknown,
  rejectProfileChangeAction: (id: string, input: unknown) =>
    rejectProfileChangeAction(id, input) as unknown,
}));

const CHANGE: AdminProfileChange = {
  id: '9a1e4c22-0000-4000-8000-000000000009',
  dealerId: '3c8f2b10-2222-4000-8000-000000000002',
  dealerSlug: 'sri-lakshmi-motors',
  dealerName: 'Sri Lakshmi Motors',
  initials: 'SL',
  status: 'PENDING',
  statusLabel: 'Waiting for review',
  statusTone: 'warn',
  tagline: 'Only diesel SUVs, every one with a full service history.',
  specialities: ['SUVs', 'Exchange'],
  liveTagline: 'Hatchbacks under ₹6 lakh, inspected in-house.',
  liveSpecialities: ['Hatchbacks', 'RC transfer'],
  submittedAt: '2026-09-09T09:00:00.000Z',
  submittedAtLabel: '09 Sep 2026',
  waitingLabel: '4 hours',
  decisionReason: null,
};

describe('the profile-change review card', () => {
  beforeEach(() => {
    approveProfileChangeAction.mockReset().mockResolvedValue({ ok: true });
    rejectProfileChangeAction.mockReset().mockResolvedValue({ ok: true });
  });

  /**
   * The whole reason the live values travel with the proposal: the question is
   * "is this *change* acceptable", and a reviewer holding the old value in
   * their head is one who approves a number appended to a sentence they
   * half-remember.
   */
  it('shows what is live beside what is proposed', () => {
    render(<ProfileChangeReview change={CHANGE} />);

    expect(screen.getByText('Hatchbacks under ₹6 lakh, inspected in-house.')).toBeInTheDocument();
    expect(
      screen.getByText('Only diesel SUVs, every one with a full service history.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Hatchbacks')).toBeInTheDocument();
    expect(screen.getByText('SUVs')).toBeInTheDocument();
    expect(screen.getByText(/waiting 4 hours/i)).toBeInTheDocument();
  });

  /**
   * `null` / `[]` on the proposed side mean *this request does not touch that
   * field*. Rendering an empty row would tell the moderator the dealer wants
   * their services removed, and approving that reading would be approving
   * something nobody asked for.
   */
  it('reads a field the edit does not touch as unchanged, not as cleared', () => {
    render(<ProfileChangeReview change={{ ...CHANGE, specialities: [] }} />);

    expect(screen.getByText('unchanged')).toBeInTheDocument();
    // The live services are still shown — they are what would survive the
    // approval, and a blank row here is the failure being guarded against.
    expect(screen.getByText('RC transfer')).toBeInTheDocument();
  });

  it('publishes on approve, naming the change and nothing else', async () => {
    const user = userEvent.setup();
    render(<ProfileChangeReview change={CHANGE} />);

    await user.click(screen.getByRole('button', { name: /publish it/i }));

    expect(approveProfileChangeAction).toHaveBeenCalledWith(CHANGE.id);
  });

  /**
   * The dealer reads the reason verbatim and it is the only account they will
   * get of why their line did not appear. "Refused" with nothing attached is
   * how a dealer concludes the product is broken and submits the same text
   * again — so the button does not work until there is a sentence.
   */
  it('will not refuse without a reason of substance', async () => {
    const user = userEvent.setup();
    render(<ProfileChangeReview change={CHANGE} />);

    await user.click(screen.getByRole('button', { name: /refuse…/i }));
    const refuse = screen.getByRole('button', { name: /refuse this change/i });
    expect(refuse).toBeDisabled();

    await user.type(screen.getByLabelText(/what should they change/i), 'no');
    expect(refuse).toBeDisabled();

    await user.type(screen.getByLabelText(/what should they change/i), ' phone numbers please');
    expect(refuse).toBeEnabled();

    await user.click(refuse);
    expect(rejectProfileChangeAction).toHaveBeenCalledWith(CHANGE.id, {
      reason: 'no phone numbers please',
    });
  });

  it('surfaces a refusal from the API rather than looking like it worked', async () => {
    const user = userEvent.setup();
    approveProfileChangeAction.mockResolvedValue({
      ok: false,
      message: 'This edit has already been published.',
    });
    render(<ProfileChangeReview change={CHANGE} />);

    await user.click(screen.getByRole('button', { name: /publish it/i }));

    expect(await screen.findByText('This edit has already been published.')).toBeInTheDocument();
  });
});

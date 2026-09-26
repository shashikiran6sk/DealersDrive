import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { rejectListingAction, requestListingChangesAction } from '@/features/admin/listing-actions';
import { DecisionDialog } from '@/features/admin/listing-review/decision-dialog';
import type * as ApiModule from '@/lib/api';

import { revalidations } from '../../../setup.js';

const apiSend = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, apiSend: (...args: unknown[]) => apiSend(...args) as unknown };
});

const ID = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  apiSend.mockReset();
});

function dialog(submit = vi.fn(() => Promise.resolve({ ok: true }))) {
  const user = userEvent.setup();
  render(
    <DecisionDialog
      id="reason"
      triggerLabel="Reject"
      title="Reject this listing"
      description="Rejection is final."
      confirmLabel="Reject listing"
      destructive
      submit={submit}
    />,
  );
  return { user, submit };
}

describe('DecisionDialog', () => {
  it('opens on its trigger and will not confirm until the reason is meaningful', async () => {
    const { user } = dialog();
    await user.click(screen.getByRole('button', { name: 'Reject' }));

    expect(screen.getByRole('dialog', { name: 'Reject this listing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject listing' })).toBeDisabled();
    await user.type(screen.getByLabelText(/reason for the dealer/i), 'Dup');
    expect(screen.getByRole('button', { name: 'Reject listing' })).toBeDisabled();
  });

  it('sends the trimmed reason and closes on success', async () => {
    const { user, submit } = dialog();
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    await user.type(screen.getByLabelText(/reason for the dealer/i), '  Duplicate listing.  ');
    await user.click(screen.getByRole('button', { name: 'Reject listing' }));

    expect(submit).toHaveBeenCalledWith('Duplicate listing.');
    expect(await screen.findByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('stays open and shows the refusal when the API says no', async () => {
    const { user } = dialog(
      vi.fn(() => Promise.resolve({ ok: false, message: 'This listing changed.' })),
    );
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    await user.type(screen.getByLabelText(/reason for the dealer/i), 'Duplicate listing.');
    await user.click(screen.getByRole('button', { name: 'Reject listing' }));

    expect(await screen.findByText('This listing changed.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('the decision actions', () => {
  it('posts a request for changes with the reason and refreshes the screens', async () => {
    apiSend.mockResolvedValue({});
    await expect(requestListingChangesAction(ID, 'Fix the odometer.')).resolves.toEqual({
      ok: true,
    });
    expect(apiSend).toHaveBeenCalledWith('POST', `/v1/admin/listings/${ID}/request-changes`, {
      reason: 'Fix the odometer.',
    });
    expect(revalidations.paths).toEqual(
      expect.arrayContaining([`/admin/listings/${ID}`, '/admin/listings']),
    );
  });

  it('posts a rejection', async () => {
    apiSend.mockResolvedValue({});
    await rejectListingAction(ID, 'Duplicate listing.');
    expect(apiSend).toHaveBeenCalledWith('POST', `/v1/admin/listings/${ID}/reject`, {
      reason: 'Duplicate listing.',
    });
  });

  it('refuses a short reason without calling the API', async () => {
    const result = await rejectListingAction(ID, 'no');
    expect(result).toMatchObject({ ok: false });
    expect(result.message).toMatch(/at least 6/);
    expect(apiSend).not.toHaveBeenCalled();
  });

  it('reports the API’s refusal, or its absence', async () => {
    const { ApiError } = await import('@/lib/api');
    apiSend.mockRejectedValueOnce(
      new ApiError({
        type: 'x',
        title: 'Conflict',
        status: 409,
        code: 'LISTING_STATE_CHANGED',
        detail: 'This listing changed.',
      }),
    );
    await expect(rejectListingAction(ID, 'Duplicate listing.')).resolves.toEqual({
      ok: false,
      message: 'This listing changed.',
    });

    apiSend.mockRejectedValueOnce(new Error('down'));
    expect((await rejectListingAction(ID, 'Duplicate listing.')).message).toMatch(/unavailable/);
  });
});

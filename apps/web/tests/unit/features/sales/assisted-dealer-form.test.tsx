vi.mock('@/features/service-location-actions', () => ({
  loadServiceLocationsAction: () =>
    Promise.resolve({
      data: [
        {
          id: 'IN-TN',
          name: 'Tamil Nadu',
          districts: [{ id: 'IN-TN-VELLORE', stateId: 'IN-TN', name: 'Vellore' }],
        },
      ],
    }),
}));

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AssistedDealerForm } from '@/features/sales/assisted-dealer-form';

/** The details form shared by create and edit: what it sends, and how a refusal reads. */
describe('AssistedDealerForm', () => {
  it('sends only filled fields, upper-casing GSTIN and PAN', async () => {
    const onSubmit = vi.fn(() => Promise.resolve({ ok: true }));
    const user = userEvent.setup();
    render(
      <AssistedDealerForm
        initial={{ legalName: 'Sri Murugan Cars' }}
        initialServices={[]}
        submitLabel="Save details"
        partial
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/^PAN/), 'aaacs1429p');
    await user.click(screen.getByRole('button', { name: 'Save details' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        legalName: 'Sri Murugan Cars',
        pan: 'AAACS1429P',
        tagline: '',
      });
    });
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('sends empty required fields on create, so the schema answers in words', async () => {
    const onSubmit = vi.fn((_values: Record<string, unknown>) => Promise.resolve({ ok: true }));
    const user = userEvent.setup();
    render(
      <AssistedDealerForm
        initial={{}}
        initialServices={[]}
        submitLabel="Create dealership"
        partial={false}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Create dealership' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ mapsUrl: '', tagline: '', specialities: [] }),
      );
    });
    const sent = onSubmit.mock.calls[0]?.[0] ?? {};
    expect(sent).not.toHaveProperty('landline');
    expect(sent).not.toHaveProperty('gstin');
  });

  it('marks the fields the API refused, by name', async () => {
    const user = userEvent.setup();
    render(
      <AssistedDealerForm
        initial={{}}
        initialServices={[]}
        submitLabel="Create dealership"
        partial={false}
        onSubmit={() =>
          Promise.resolve({
            ok: false,
            message: 'Check the highlighted fields.',
            fieldErrors: { email: 'Enter a valid email address.' },
          })
        }
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Create dealership' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Dealer’s email/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Check the highlighted fields.')).toBeInTheDocument();
  });

  it('is read-only when the dealership is locked', () => {
    render(
      <AssistedDealerForm
        initial={{}}
        initialServices={[]}
        submitLabel="Save details"
        partial
        disabled
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Contact person/)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save details' })).toBeDisabled();
  });
});

import type { DealerListing } from '@dealers-drive/contracts';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ListingLifecycleActions,
  ListingLifecyclePanel,
  type LifecycleSubmit,
} from '@/features/dealer/listing-lifecycle';

/**
 * The dealer's lifecycle controls (**R70**): only the moves the server says
 * this listing offers, each behind a confirmation, and a withdrawal that cannot
 * be sent without a reason.
 */
const ID = '11111111-1111-4111-8111-111111111111';
const TITLE = '2023 Hyundai Creta SX(O)';

function actions(list: DealerListing['actions'], submit?: LifecycleSubmit) {
  return render(
    <ListingLifecycleActions
      vehicleId={ID}
      vehicleTitle={TITLE}
      actions={list}
      {...(submit ? { submit } : {})}
    />,
  );
}

function buttons(): string[] {
  const group = screen.getByRole('group', { name: `Change the listing status of ${TITLE}` });
  return within(group)
    .getAllByRole('button')
    .map((button) => button.textContent ?? '');
}

describe('which moves are offered', () => {
  it.each([
    [
      ['reserve', 'markSold', 'withdraw'],
      ['Reserve', 'Mark sold', 'Withdraw'],
    ],
    [
      ['reactivate', 'markSold', 'withdraw'],
      ['Make active', 'Mark sold', 'Withdraw'],
    ],
    [['relist'], ['Relist']],
  ] as const)('offers %j as %j', (list, labels) => {
    actions([...list]);
    expect(buttons()).toEqual(labels);
  });

  it('renders nothing for a sold car, or a listing still in review', () => {
    const { container } = actions([]);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('confirming a move', () => {
  it('asks before reserving, in the product’s words, then sends the move', async () => {
    const submit = vi.fn<LifecycleSubmit>(() => Promise.resolve({ ok: true }));
    actions(['reserve', 'markSold', 'withdraw'], submit);

    fireEvent.click(screen.getByRole('button', { name: 'Reserve' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reserve this vehicle?' });
    expect(dialog).toHaveTextContent(
      'The listing will remain visible but customers will not be able to open or enquire about it.',
    );
    expect(submit).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reserve vehicle' }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(ID, 'reserve', undefined));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('warns that a sale is final', async () => {
    actions(['markSold']);
    fireEvent.click(screen.getByRole('button', { name: 'Mark sold' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mark this vehicle as sold?' });
    expect(dialog).toHaveTextContent('It will be removed from public listings and search.');
    expect(dialog).toHaveTextContent('cannot be put back on sale');
  });

  it('sends nothing when cancelled', async () => {
    const submit = vi.fn<LifecycleSubmit>(() => Promise.resolve({ ok: true }));
    actions(['relist'], submit);
    fireEvent.click(screen.getByRole('button', { name: 'Relist' }));
    const dialog = await screen.findByRole('dialog', { name: 'Relist this vehicle?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(submit).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and shows the refusal', async () => {
    const submit = vi.fn<LifecycleSubmit>(() =>
      Promise.resolve({ ok: false, message: 'This listing changed while you were looking at it.' }),
    );
    actions(['reactivate'], submit);
    fireEvent.click(screen.getByRole('button', { name: 'Make active' }));
    const dialog = await screen.findByRole('dialog', { name: 'Put this vehicle back on sale?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make active' }));

    expect(await within(dialog).findByText(/changed while you were looking/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('withdrawing', () => {
  it('cannot be confirmed until a reason is chosen, and sends the reason and trimmed note', async () => {
    const submit = vi.fn<LifecycleSubmit>(() => Promise.resolve({ ok: true }));
    actions(['withdraw'], submit);

    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    const dialog = await screen.findByRole('dialog', { name: 'Withdraw this listing?' });
    expect(dialog).toHaveTextContent(
      'It will be removed from public listings. You can relist it later.',
    );
    const confirm = within(dialog).getByRole('button', { name: 'Withdraw listing' });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText('Reason'), {
      target: { value: 'DOCUMENT_ISSUE' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Note/), {
      target: { value: '  RC is with the bank.  ' },
    });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(ID, 'withdraw', {
        reason: 'DOCUMENT_ISSUE',
        note: 'RC is with the bank.',
      }),
    );
  });

  it('offers every reason', async () => {
    actions(['withdraw']);
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    const dialog = await screen.findByRole('dialog');
    const options = within(within(dialog).getByLabelText('Reason'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual([
      'Choose a reason',
      'No longer for sale',
      'Issue with the vehicle',
      'Issue with the documents',
      'Paused for now',
      'Another reason',
    ]);
  });

  it('sends no note when none was written', async () => {
    const submit = vi.fn<LifecycleSubmit>(() => Promise.resolve({ ok: true }));
    actions(['withdraw'], submit);
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'OTHER' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Withdraw listing' }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(ID, 'withdraw', { reason: 'OTHER' }));
  });
});

function listing(overrides: Partial<DealerListing>): DealerListing {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    status: 'ACTIVE',
    statusLabel: 'Active',
    statusTone: 'ok',
    reason: null,
    submittedAt: null,
    publishedAt: '2026-09-20T10:00:00.000Z',
    slug: '2023-hyundai-creta-katpadi-abc',
    reservedAt: null,
    soldAt: null,
    withdrawnAt: null,
    withdrawal: null,
    canEdit: false,
    canSubmit: false,
    canDelete: false,
    actions: ['reserve', 'markSold', 'withdraw'],
    ...overrides,
  };
}

describe('ListingLifecyclePanel', () => {
  it('links a live car to its public page', () => {
    render(<ListingLifecyclePanel vehicleId={ID} vehicleTitle={TITLE} listing={listing({})} />);
    expect(screen.getByRole('link', { name: 'View on site' })).toHaveAttribute(
      'href',
      '/car/2023-hyundai-creta-katpadi-abc',
    );
    expect(screen.getByRole('button', { name: 'Reserve' })).toBeInTheDocument();
  });

  it('shows a withdrawn listing’s reason and note, and offers only Relist', () => {
    render(
      <ListingLifecyclePanel
        vehicleId={ID}
        vehicleTitle={TITLE}
        listing={listing({
          status: 'WITHDRAWN',
          actions: ['relist'],
          withdrawal: {
            reason: 'DOCUMENT_ISSUE',
            reasonLabel: 'Issue with the documents',
            note: 'RC is with the bank.',
          },
        })}
      />,
    );
    expect(screen.getByText('Issue with the documents')).toBeInTheDocument();
    expect(screen.getByText('RC is with the bank.')).toBeInTheDocument();
    expect(buttons()).toEqual(['Relist']);
    expect(screen.queryByRole('link', { name: 'View on site' })).not.toBeInTheDocument();
  });

  it('renders nothing for a sold car', () => {
    const { container } = render(
      <ListingLifecyclePanel
        vehicleId={ID}
        vehicleTitle={TITLE}
        listing={listing({ status: 'SOLD', actions: [] })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

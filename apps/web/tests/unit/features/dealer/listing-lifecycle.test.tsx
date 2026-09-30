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
 * be sent without a reason. A reserved or withdrawn car is never put back on
 * sale from here — the dealer requests it, and an admin decides.
 */
const ID = '11111111-1111-4111-8111-111111111111';
const TITLE = '2023 Hyundai Creta SX(O)';

function actions(list: DealerListing['actions'], submit?: LifecycleSubmit, pending = false) {
  return render(
    <ListingLifecycleActions
      vehicleId={ID}
      vehicleTitle={TITLE}
      actions={list}
      reactivationPending={pending}
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
      ['Mark reserved', 'Mark sold', 'Withdraw'],
    ],
    [
      ['markSold', 'requestReactivation'],
      ['Mark sold', 'Request reactivation'],
    ],
    [['requestReactivation'], ['Request reactivation']],
  ] as const)('offers %j as %j', (list, labels) => {
    actions([...list]);
    expect(buttons()).toEqual(labels);
  });

  it('renders nothing for a sold car, or a listing still in review', () => {
    const { container } = actions([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('never offers a direct way back on sale', () => {
    actions(['markSold', 'requestReactivation']);
    expect(screen.queryByRole('button', { name: /make active|relist/i })).not.toBeInTheDocument();
  });

  it('says a request is pending, and offers no second one', () => {
    actions(['markSold'], undefined, true);
    const group = screen.getByRole('group', { name: `Change the listing status of ${TITLE}` });
    expect(within(group).getByText('Reactivation pending approval')).toBeInTheDocument();
    expect(buttons()).toEqual(['Mark sold']);
  });

  it('shows the pending state on a withdrawn car with no other move', () => {
    actions([], undefined, true);
    expect(screen.getByText('Reactivation pending approval')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('confirming a move', () => {
  it('asks before reserving, in the product’s words, then sends the move', async () => {
    const submit = vi.fn<LifecycleSubmit>(() => Promise.resolve({ ok: true }));
    actions(['reserve', 'markSold', 'withdraw'], submit);

    fireEvent.click(screen.getByRole('button', { name: 'Mark reserved' }));
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
    actions(['requestReactivation'], submit);
    fireEvent.click(screen.getByRole('button', { name: 'Request reactivation' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Ask to put this vehicle back on sale?',
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(submit).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and shows the refusal', async () => {
    const submit = vi.fn<LifecycleSubmit>(() =>
      Promise.resolve({ ok: false, message: 'This listing changed while you were looking at it.' }),
    );
    actions(['requestReactivation'], submit);
    fireEvent.click(screen.getByRole('button', { name: 'Request reactivation' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Ask to put this vehicle back on sale?',
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send request' }));

    expect(await within(dialog).findByText(/changed while you were looking/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('requesting reactivation', () => {
  it('explains an admin decides, and sends the trimmed note', async () => {
    const submit = vi.fn<LifecycleSubmit>(() => Promise.resolve({ ok: true }));
    actions(['requestReactivation'], submit);
    fireEvent.click(screen.getByRole('button', { name: 'Request reactivation' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Ask to put this vehicle back on sale?',
    });
    expect(dialog).toHaveTextContent('until an admin approves it');
    fireEvent.change(within(dialog).getByLabelText(/Note for the reviewer/), {
      target: { value: '  Buyer backed out.  ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send request' }));
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(ID, 'requestReactivation', {
        reason: 'Buyer backed out.',
      }),
    );
  });

  it('sends an empty request when no note was written', async () => {
    const submit = vi.fn<LifecycleSubmit>(() => Promise.resolve({ ok: true }));
    actions(['requestReactivation'], submit);
    fireEvent.click(screen.getByRole('button', { name: 'Request reactivation' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(ID, 'requestReactivation', {}));
  });
});

describe('withdrawing', () => {
  it('cannot be confirmed until a reason is chosen, and sends the reason and trimmed note', async () => {
    const submit = vi.fn<LifecycleSubmit>(() => Promise.resolve({ ok: true }));
    actions(['withdraw'], submit);

    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    const dialog = await screen.findByRole('dialog', { name: 'Withdraw this listing?' });
    expect(dialog).toHaveTextContent(
      'It will be removed from public listings. To put it back on sale later, request reactivation',
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

const REQUEST: NonNullable<DealerListing['reactivation']> = {
  id: '44444444-4444-4444-8444-444444444444',
  status: 'PENDING',
  statusLabel: 'Reactivation pending approval',
  statusTone: 'warn',
  fromStatus: 'WITHDRAWN',
  reason: null,
  requestedAt: '2026-09-28T10:00:00.000Z',
  reviewedAt: null,
  adminNote: null,
};

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
    reactivation: null,
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
    expect(screen.getByRole('button', { name: 'Mark reserved' })).toBeInTheDocument();
  });

  it('shows a withdrawn listing’s reason and note, and offers only a reactivation request', () => {
    render(
      <ListingLifecyclePanel
        vehicleId={ID}
        vehicleTitle={TITLE}
        listing={listing({
          status: 'WITHDRAWN',
          actions: ['requestReactivation'],
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
    expect(buttons()).toEqual(['Request reactivation']);
    expect(screen.queryByRole('link', { name: 'View on site' })).not.toBeInTheDocument();
  });

  it('shows a pending request on a withdrawn car', () => {
    render(
      <ListingLifecyclePanel
        vehicleId={ID}
        vehicleTitle={TITLE}
        listing={listing({ status: 'WITHDRAWN', actions: [], reactivation: REQUEST })}
      />,
    );
    expect(screen.getByText('Reactivation pending approval')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows why a request was declined, and lets the dealer ask again', () => {
    render(
      <ListingLifecyclePanel
        vehicleId={ID}
        vehicleTitle={TITLE}
        listing={listing({
          status: 'RESERVED',
          actions: ['markSold', 'requestReactivation'],
          reactivation: {
            ...REQUEST,
            status: 'REJECTED',
            statusLabel: 'Reactivation declined',
            statusTone: 'err',
            fromStatus: 'RESERVED',
            reviewedAt: '2026-09-29T10:00:00.000Z',
            adminNote: 'Still with the buyer’s bank.',
          },
        })}
      />,
    );
    expect(screen.getByText('Reactivation declined:')).toBeInTheDocument();
    expect(screen.getByText('Still with the buyer’s bank.')).toBeInTheDocument();
    expect(buttons()).toEqual(['Mark sold', 'Request reactivation']);
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

import type {
  AdminSupportTicketDetail,
  AdminSupportTicketRow,
  AdminSupportTicketsResponse,
} from '@dealers-drive/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminSupportTicketPage from '@/app/(admin)/admin/support/[id]/page';
import AdminSupportPage from '@/app/(admin)/admin/support/page';
import {
  addTicketNoteAction,
  replyToTicketAction,
  updateTicketAction,
} from '@/features/admin/support-actions';
import { TicketComposer, TicketControls } from '@/features/admin/support-ticket';
import type * as ApiModule from '@/lib/api';

import { navigationState, revalidations } from '../../../setup';

/**
 * R91 — `/admin/support` and `/admin/support/[id]`.
 *
 * The queue forwards only filters the API knows. The workspace keeps a reply
 * to the customer and an internal note visibly apart, offers only the status
 * moves the ticket allows, and sends exactly the fields that changed.
 */
const apiGetParsed = vi.fn();
const apiGet = vi.fn();
const apiSend = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown,
    apiGet: (...args: unknown[]) => apiGet(...args) as unknown,
    apiSend: (...args: unknown[]) => apiSend(...args) as unknown,
  };
});

const ID = '11111111-1111-4111-8111-111111111111';
const ME = {
  id: '77777777-7777-4777-8777-777777777777',
  label: 'Priya (ops)',
  email: 'ops@dealers-drive.test',
};
const COLLEAGUE = {
  id: '88888888-8888-4888-8888-888888888888',
  label: 'Arun',
  email: 'arun@dealers-drive.test',
};

const ROW: AdminSupportTicketRow = {
  id: ID,
  reference: 'DD-1042',
  subject: 'The dealer has not called me back',
  category: 'ENQUIRY_ISSUE',
  categoryLabel: 'Problem with an enquiry',
  status: 'OPEN',
  statusLabel: 'Open',
  statusTone: 'accent',
  priority: 'HIGH',
  priorityLabel: 'High',
  priorityTone: 'warn',
  customer: {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Meera Iyer',
    phoneDisplay: '+91 98400 10001',
  },
  context: {
    enquiryId: '33333333-3333-4333-8333-333333333333',
    vehicleTitle: '2021 Honda City VX',
    registrationDisplay: 'TN 09 BX 0001',
    dealerName: 'Sri Lakshmi Motors',
  },
  assignee: null,
  createdAt: '2026-09-30T09:02:00.000Z',
  createdLabel: '30 Sep 2026, 14:32',
  updatedAt: '2026-09-30T10:00:00.000Z',
  updatedLabel: '30 Sep 2026, 15:30',
};

function queue(overrides: Partial<AdminSupportTicketsResponse> = {}): AdminSupportTicketsResponse {
  return {
    data: [
      ROW,
      {
        ...ROW,
        id: '44444444-4444-4444-8444-444444444444',
        reference: 'DD-1043',
        context: null,
        assignee: COLLEAGUE,
        customer: { ...ROW.customer, phoneDisplay: null },
      },
    ],
    page: { nextCursor: null, hasMore: false },
    counts: { ALL: 9, OPEN: 4, IN_PROGRESS: 2, WAITING_FOR_CUSTOMER: 1, RESOLVED: 1, CLOSED: 1 },
    assignees: [ME, COLLEAGUE],
    ...overrides,
  };
}

function ticket(overrides: Partial<AdminSupportTicketDetail> = {}): AdminSupportTicketDetail {
  return {
    ...ROW,
    description: 'I enquired three days ago and nobody has called.',
    resolvedLabel: null,
    closedLabel: null,
    canReply: true,
    transitions: ['IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'],
    customer: {
      id: ROW.customer.id,
      name: 'Meera Iyer',
      phone: '+919840010001',
      phoneDisplay: '+91 98400 10001',
      memberSinceLabel: '20 Sep 2026',
      ticketCount: 3,
    },
    enquiry: {
      id: '33333333-3333-4333-8333-333333333333',
      statusLabel: 'Contacted',
      customerStatusLabel: 'Contacted',
      statusTone: 'ok',
      sentLabel: '27 Sep 2026, 10:00',
      message: 'Is the service history available?',
      adminHref: '/admin/enquiries/33333333-3333-4333-8333-333333333333',
    },
    vehicle: {
      listingId: '55555555-5555-4555-8555-555555555555',
      title: '2021 Honda City VX',
      registrationDisplay: 'TN 09 BX 0001',
      listingStatus: 'SOLD',
      listingStatusLabel: 'Sold',
      listingStatusTone: 'neutral',
      image: null,
      publicHref: null,
      adminHref: '/admin/listings/55555555-5555-4555-8555-555555555555',
    },
    dealer: {
      id: '66666666-6666-4666-8666-666666666666',
      name: 'Sri Lakshmi Motors',
      statusLabel: 'Active',
      statusTone: 'ok',
      phoneDisplay: '+91 94430 00000',
      adminHref: '/admin/dealers/66666666-6666-4666-8666-666666666666',
    },
    messages: [
      {
        id: '99999999-9999-4999-8999-999999999991',
        author: 'SUPPORT',
        authorLabel: 'Dealers-Drive support',
        authorName: 'Priya (ops)',
        body: 'We have asked the dealer to call you.',
        createdAt: '2026-09-30T10:00:00.000Z',
        createdLabel: '30 Sep 2026, 15:30',
      },
      {
        id: '99999999-9999-4999-8999-999999999992',
        author: 'CUSTOMER',
        authorLabel: 'Meera Iyer',
        authorName: 'Meera Iyer',
        body: 'Thank you.',
        createdAt: '2026-09-30T11:00:00.000Z',
        createdLabel: '30 Sep 2026, 16:30',
      },
    ],
    notes: [
      {
        id: '99999999-9999-4999-8999-999999999993',
        authorName: 'Priya (ops)',
        body: 'Called the dealer at 14:32.',
        createdAt: '2026-09-30T09:30:00.000Z',
        createdLabel: '30 Sep 2026, 15:00',
      },
    ],
    history: [
      {
        action: 'support_ticket.created',
        label: 'Request created',
        detail: null,
        actor: 'Customer',
        at: '2026-09-30T09:02:00.000Z',
        atLabel: '30 Sep 2026, 14:32',
      },
      {
        action: 'support_ticket.priority_changed',
        label: 'Priority changed',
        detail: 'Normal → High',
        actor: 'Dealers-Drive · Priya (ops)',
        at: '2026-09-30T09:10:00.000Z',
        atLabel: '30 Sep 2026, 14:40',
      },
    ],
    assignees: [ME, COLLEAGUE],
    ...overrides,
  };
}

async function apiError(status: number, code: string, detail: string) {
  const { ApiError } = await import('@/lib/api');
  return new ApiError({ type: 'x', title: code, status, code, detail });
}

beforeEach(() => {
  apiGetParsed.mockReset();
  apiGet.mockReset();
  apiSend.mockReset();
  navigationState.refreshed = 0;
  revalidations.paths = [];
});

describe('/admin/support', () => {
  it('reads uncached, forwarding only filters the API knows', async () => {
    apiGetParsed.mockResolvedValue(queue());
    render(
      await AdminSupportPage({
        searchParams: Promise.resolve({
          status: 'OPEN',
          category: 'ENQUIRY_ISSUE',
          priority: 'BLOCKER',
          assignee: 'me',
          q: ' dd-1042 ',
          from: '2026-09-01',
          to: 'never',
          cursor: 'c1',
        }),
      }),
    );
    expect(apiGetParsed).toHaveBeenLastCalledWith(
      expect.anything(),
      '/v1/admin/support/tickets?status=OPEN&category=ENQUIRY_ISSUE&assignee=me&q=dd-1042&from=2026-09-01&cursor=c1',
      { revalidate: false },
    );

    render(await AdminSupportPage({ searchParams: Promise.resolve({ assignee: 'nobody-real' }) }));
    expect(apiGetParsed).toHaveBeenLastCalledWith(expect.anything(), '/v1/admin/support/tickets', {
      revalidate: false,
    });
  });

  it('shows tabs with counts, filters, and a row per ticket with its context', async () => {
    apiGetParsed.mockResolvedValue(queue({ page: { nextCursor: 'c2', hasMore: true } }));
    render(await AdminSupportPage({ searchParams: Promise.resolve({ assignee: COLLEAGUE.id }) }));

    expect(screen.getByRole('heading', { name: 'Support Tickets' })).toBeInTheDocument();
    expect(screen.getByText('9 tickets')).toBeInTheDocument();
    const tabs = within(screen.getByRole('navigation', { name: 'Filter by status' }));
    expect(tabs.getByRole('link', { name: /Waiting for customer/ })).toHaveAttribute(
      'href',
      `/admin/support?status=WAITING_FOR_CUSTOMER&assignee=${COLLEAGUE.id}`,
    );
    expect(screen.getByLabelText('Assignee')).toHaveValue(COLLEAGUE.id);

    const table = within(screen.getByRole('table'));
    expect(table.getByText('DD-1042')).toBeInTheDocument();
    expect(table.getByText('2021 Honda City VX')).toBeInTheDocument();
    expect(table.getByText('No enquiry linked')).toBeInTheDocument();
    expect(table.getByText('No number on file')).toBeInTheDocument();
    expect(table.getByText('Arun')).toBeInTheDocument();
    expect(table.getByRole('link', { name: 'Open ticket DD-1042' })).toHaveAttribute(
      'href',
      `/admin/support/${ID}`,
    );
    expect(screen.getByRole('link', { name: 'Show more' })).toHaveAttribute(
      'href',
      `/admin/support?assignee=${COLLEAGUE.id}&cursor=c2`,
    );
    expect(screen.getByRole('link', { name: 'Clear' })).toHaveAttribute('href', '/admin/support');
  });

  it('says there are none at all, or none matching', async () => {
    apiGetParsed.mockResolvedValue(queue({ data: [] }));
    const { unmount } = render(await AdminSupportPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText('No support tickets found')).toBeInTheDocument();
    unmount();
    render(await AdminSupportPage({ searchParams: Promise.resolve({ status: 'CLOSED' }) }));
    expect(screen.getByText('No support tickets match these filters')).toBeInTheDocument();
  });
});

describe('/admin/support/[id]', () => {
  async function workspace(detail = ticket()) {
    apiGetParsed.mockResolvedValue(detail);
    apiGet.mockResolvedValue({
      operator: { email: 'OPS@dealers-drive.test', adminRole: 'SUPPORT' },
    });
    render(await AdminSupportTicketPage({ params: Promise.resolve({ id: ID }) }));
  }

  it('shows the conversation, the notes apart from it, and the enquiry, car and dealer', async () => {
    await workspace();
    expect(apiGetParsed).toHaveBeenCalledWith(
      expect.anything(),
      `/v1/admin/support/tickets/${ID}`,
      {
        revalidate: false,
      },
    );

    const conversation = within(screen.getByRole('region', { name: 'Conversation' }));
    expect(conversation.getByText(/nobody has called/)).toBeInTheDocument();
    expect(conversation.getByText('We have asked the dealer to call you.')).toBeInTheDocument();
    expect(conversation.queryByText('Called the dealer at 14:32.')).toBeNull();

    const notes = within(screen.getByRole('region', { name: 'Internal notes' }));
    expect(notes.getByText('Called the dealer at 14:32.')).toBeInTheDocument();
    expect(notes.getByText(/never shown to the customer/)).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Open enquiry' })).toHaveAttribute(
      'href',
      '/admin/enquiries/33333333-3333-4333-8333-333333333333',
    );
    expect(screen.getByRole('link', { name: 'Open listing review' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open dealer' })).toHaveAttribute(
      'href',
      '/admin/dealers/66666666-6666-4666-8666-666666666666',
    );
    expect(screen.getByText('3 support requests')).toBeInTheDocument();
    expect(
      screen.getByText('Normal → High · Dealers-Drive · Priya (ops) ·', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assign to me' })).toBeInTheDocument();
  });

  it('says when a ticket has no enquiry, notes or history, and when it is closed', async () => {
    await workspace(
      ticket({
        status: 'CLOSED',
        statusLabel: 'Closed',
        canReply: false,
        transitions: [],
        closedLabel: '01 Oct 2026, 10:00',
        resolvedLabel: '30 Sep 2026, 18:00',
        enquiry: null,
        vehicle: null,
        dealer: null,
        notes: [],
        history: [],
        assignee: ME,
        customer: { ...ticket().customer, phoneDisplay: null },
      }),
    );
    expect(screen.getByText('This request is not linked to an enquiry.')).toBeInTheDocument();
    expect(screen.getByText('No internal notes yet.')).toBeInTheDocument();
    expect(screen.getByText('No recorded changes.')).toBeInTheDocument();
    expect(screen.getByText(/Closed tickets are final/)).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Reply to customer' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Internal note' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Assign to me' })).toBeNull();
    expect(screen.getByText('Closed 01 Oct 2026, 10:00')).toBeInTheDocument();
  });

  it('answers an unknown ticket with the 404 page, and passes anything else on', async () => {
    apiGetParsed.mockRejectedValue(await apiError(404, 'SUPPORT_TICKET_NOT_FOUND', 'Gone'));
    apiGet.mockResolvedValue({ operator: { email: 'x' } });
    await expect(AdminSupportTicketPage({ params: Promise.resolve({ id: ID }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    apiGetParsed.mockRejectedValue(new Error('boom'));
    await expect(AdminSupportTicketPage({ params: Promise.resolve({ id: ID }) })).rejects.toThrow(
      'boom',
    );
  });
});

describe('TicketControls', () => {
  it('offers only the allowed moves, and sends only what changed', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TicketControls ticket={ticket()} viewerId={ME.id} save={save} />);

    const status = screen.getByLabelText('Status');
    expect(
      within(status)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Open (current)', 'In progress', 'Waiting for customer', 'Resolved', 'Closed']);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Nothing to save.')).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();

    await user.selectOptions(status, 'IN_PROGRESS');
    await user.selectOptions(screen.getByLabelText('Priority'), 'URGENT');
    await user.click(screen.getByRole('button', { name: 'Assign to me' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(save).toHaveBeenCalledWith(ID, {
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      assignedAdminId: ME.id,
    });
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(navigationState.refreshed).toBe(1);
  });

  it('unassigns, and shows the API’s refusal', async () => {
    const save = vi
      .fn()
      .mockResolvedValue({ ok: false, message: 'A ticket that is open cannot be moved.' });
    const user = userEvent.setup();
    render(<TicketControls ticket={ticket({ assignee: COLLEAGUE })} viewerId={null} save={save} />);
    expect(screen.queryByRole('button', { name: 'Assign to me' })).toBeNull();
    await user.selectOptions(screen.getByLabelText('Assigned to'), '');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(save).toHaveBeenCalledWith(ID, { assignedAdminId: null });
    expect(await screen.findByRole('alert')).toHaveTextContent('cannot be moved');
  });
});

describe('TicketComposer', () => {
  it('replies to the customer by default, and switches to a visibly different internal note', async () => {
    const reply = vi.fn().mockResolvedValue({ ok: true });
    const note = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TicketComposer ticketId={ID} canReply reply={reply} note={note} />);

    expect(screen.getByRole('radio', { name: 'Reply to customer' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByText(/customer will see this reply/)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox'), 'We are on it.');
    await user.click(screen.getByRole('button', { name: 'Send reply to customer' }));
    expect(reply).toHaveBeenCalledWith(
      ID,
      'We are on it.',
      expect.stringMatching(/^[a-f0-9-]{36}$/),
    );
    expect(note).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));

    await user.click(screen.getByRole('radio', { name: 'Internal note' }));
    expect(
      screen.getByText('Private. The customer never sees internal notes.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send reply to customer' })).toBeNull();
    await user.type(screen.getByRole('textbox'), 'Dealer says they rang twice.');
    await user.click(screen.getByRole('button', { name: 'Add internal note' }));
    expect(note).toHaveBeenCalledWith(ID, 'Dealer says they rang twice.');
    expect(reply).toHaveBeenCalledTimes(1);
  });

  it('keeps the text and shows the refusal when it cannot save', async () => {
    const reply = vi.fn().mockResolvedValue({ ok: false, message: 'This ticket is closed.' });
    const user = userEvent.setup();
    render(<TicketComposer ticketId={ID} canReply reply={reply} />);
    await user.type(screen.getByRole('textbox'), 'Hello');
    await user.click(screen.getByRole('button', { name: 'Send reply to customer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This ticket is closed.');
    expect(screen.getByRole('textbox')).toHaveValue('Hello');
  });
});

describe('admin support Server Actions', () => {
  it('reply, note and update call the API and redraw the ticket and the queue', async () => {
    apiSend.mockResolvedValue(ticket());
    expect(await replyToTicketAction(ID, ' Hi ')).toEqual({ ok: true });
    expect(apiSend).toHaveBeenLastCalledWith('POST', `/v1/admin/support/tickets/${ID}/messages`, {
      message: 'Hi',
    });
    expect(await addTicketNoteAction(ID, 'Called')).toEqual({ ok: true });
    expect(apiSend).toHaveBeenLastCalledWith('POST', `/v1/admin/support/tickets/${ID}/notes`, {
      note: 'Called',
    });
    expect(await updateTicketAction(ID, { priority: 'LOW', assignedAdminId: null })).toEqual({
      ok: true,
    });
    expect(apiSend).toHaveBeenLastCalledWith('PATCH', `/v1/admin/support/tickets/${ID}`, {
      priority: 'LOW',
      assignedAdminId: null,
    });
    expect(revalidations.paths).toContain(`/admin/support/${ID}`);
    expect(revalidations.paths).toContain('/admin/support');
  });

  it('checks input before asking the API', async () => {
    expect(await replyToTicketAction('nope', 'Hi')).toMatchObject({ ok: false });
    expect(await replyToTicketAction(ID, ' ')).toEqual({
      ok: false,
      message: 'Write a message first.',
    });
    expect(await addTicketNoteAction('nope', 'x')).toMatchObject({ ok: false });
    expect(await addTicketNoteAction(ID, '')).toEqual({
      ok: false,
      message: 'Write a note first.',
    });
    expect(await updateTicketAction('nope', { priority: 'LOW' })).toMatchObject({ ok: false });
    expect(await updateTicketAction(ID, {})).toEqual({
      ok: false,
      message: 'Change the status, the priority or the assignee.',
    });
    expect(apiSend).not.toHaveBeenCalled();
  });

  it('passes the API’s refusal on, and copes with it being away', async () => {
    apiSend.mockRejectedValue(await apiError(409, 'SUPPORT_TICKET_TRANSITION', 'Not allowed.'));
    expect(await updateTicketAction(ID, { status: 'OPEN' })).toEqual({
      ok: false,
      message: 'Not allowed.',
    });
    apiSend.mockRejectedValue(new TypeError('fetch failed'));
    expect(await replyToTicketAction(ID, 'Hi')).toMatchObject({ ok: false });
  });
});

import type {
  CustomerEnquiry,
  CustomerSupportTicket,
  CustomerSupportTicketsResponse,
} from '@dealers-drive/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SupportRequestPage from '@/app/(public)/support-requests/[id]/page';
import SupportRequestLoading from '@/app/(public)/support-requests/[id]/loading';
import NewSupportRequestPage from '@/app/(public)/support-requests/new/page';
import SupportRequestsPage from '@/app/(public)/support-requests/page';
import {
  createSupportRequestAction,
  replySupportRequestAction,
} from '@/features/support/support-actions';
import { SupportReplyForm, SupportRequestForm } from '@/features/support/support-requests';
import type * as ApiModule from '@/lib/api';

import { navigationState, revalidations } from '../../../setup';

/**
 * R90 — the customer's support requests: one area, `/support-requests`, to
 * create a request and follow it. The pages read uncached and send a signed-out
 * visitor to the customer login and back; the form refuses a second press while
 * the first is in flight; nothing a customer can do sets a priority.
 */
const apiGetParsed = vi.fn();
const apiSend = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown,
    apiSend: (...args: unknown[]) => apiSend(...args) as unknown,
  };
});

const ID = '11111111-1111-4111-8111-111111111111';
const ENQUIRY_ID = '22222222-2222-4222-8222-222222222222';

async function apiError(status: number, code: string, detail?: string, errors?: unknown[]) {
  const { ApiError } = await import('@/lib/api');
  return new ApiError({
    type: 'x',
    title: code,
    status,
    code,
    ...(detail ? { detail } : {}),
    ...(errors ? { errors } : {}),
  } as never);
}

function ticket(overrides: Partial<CustomerSupportTicket> = {}): CustomerSupportTicket {
  return {
    id: ID,
    reference: 'DD-1042',
    subject: 'The dealer has not called me back',
    category: 'ENQUIRY_ISSUE',
    categoryLabel: 'Problem with an enquiry',
    status: 'WAITING_FOR_CUSTOMER',
    statusLabel: 'Awaiting your reply',
    statusTone: 'warn',
    createdAt: '2026-09-30T09:02:00.000Z',
    createdLabel: '30 Sep 2026, 14:32',
    updatedAt: '2026-09-30T10:00:00.000Z',
    updatedLabel: '30 Sep 2026, 15:30',
    description: 'I enquired three days ago and nobody has called.',
    canReply: true,
    messages: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        author: 'SUPPORT',
        authorLabel: 'Dealers-Drive support',
        body: 'Which number should the dealer call?',
        createdAt: '2026-09-30T10:00:00.000Z',
        createdLabel: '30 Sep 2026, 15:30',
      },
    ],
    enquiry: {
      id: ENQUIRY_ID,
      vehicleTitle: '2021 Honda City VX',
      dealerName: 'Sri Lakshmi Motors',
      statusLabel: 'Sent',
      sentLabel: '27 Sep 2026',
      vehicleHref: '/car/2021-honda-city-vx',
    },
    ...overrides,
  };
}

function list(overrides: Partial<CustomerSupportTicketsResponse> = {}) {
  const { description: _d, canReply: _c, messages: _m, enquiry: _e, ...row } = ticket();
  return { data: [row], page: { nextCursor: null, hasMore: false }, ...overrides };
}

const ENQUIRY: CustomerEnquiry = {
  id: ENQUIRY_ID,
  status: 'SENT',
  statusLabel: 'Sent',
  statusTone: 'accent',
  message: null,
  createdAt: '2026-09-27T09:00:00.000Z',
  createdLabel: '27 Sep 2026',
  dealerName: 'Sri Lakshmi Motors',
  vehicle: { title: '2021 Honda City VX', href: null },
};

beforeEach(() => {
  apiGetParsed.mockReset();
  apiSend.mockReset();
  navigationState.pushed = [];
  navigationState.refreshed = 0;
  revalidations.paths = [];
});

async function redirectOf(work: () => Promise<unknown>): Promise<string | null> {
  try {
    await work();
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return message.startsWith('NEXT_REDIRECT:') ? message.slice('NEXT_REDIRECT:'.length) : null;
  }
}

describe('/support-requests', () => {
  it('reads the customer’s requests uncached, and lists them', async () => {
    apiGetParsed.mockResolvedValue(list({ page: { nextCursor: 'c2', hasMore: true } }));
    render(await SupportRequestsPage({ searchParams: Promise.resolve({ cursor: 'c1' }) }));

    expect(apiGetParsed).toHaveBeenCalledWith(expect.anything(), '/v1/support/tickets?cursor=c1', {
      revalidate: false,
    });
    const item = within(screen.getByRole('list', { name: 'Your support requests' })).getByRole(
      'link',
    );
    expect(item).toHaveAttribute('href', `/support-requests/${ID}`);
    expect(item).toHaveTextContent('DD-1042');
    expect(item).toHaveTextContent('Awaiting your reply');
    expect(item).toHaveTextContent('Problem with an enquiry');
    expect(item).toHaveTextContent('Updated 30 Sep 2026, 15:30');
    expect(screen.getByRole('link', { name: 'Create support request' })).toHaveAttribute(
      'href',
      '/support-requests/new',
    );
    expect(screen.getByRole('link', { name: 'Show more' })).toHaveAttribute(
      'href',
      '/support-requests?cursor=c2',
    );
  });

  it('invites a first request when there are none', async () => {
    apiGetParsed.mockResolvedValue(list({ data: [] }));
    render(await SupportRequestsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText('You haven’t created any support requests yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create support request' })).toBeInTheDocument();
  });

  it('sends a signed-out visitor to the customer login and back', async () => {
    apiGetParsed.mockRejectedValue(await apiError(401, 'UNAUTHENTICATED'));
    expect(await redirectOf(() => SupportRequestsPage({ searchParams: Promise.resolve({}) }))).toBe(
      '/login?returnTo=%2Fsupport-requests',
    );

    apiGetParsed.mockRejectedValue(new Error('boom'));
    await expect(SupportRequestsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'boom',
    );
  });
});

describe('/support-requests/new', () => {
  it('offers the customer’s own enquiries, preselecting one from the link', async () => {
    apiGetParsed.mockResolvedValue({ data: [ENQUIRY], page: { nextCursor: null, hasMore: false } });
    render(await NewSupportRequestPage({ searchParams: Promise.resolve({ enquiry: ENQUIRY_ID }) }));

    expect(apiGetParsed).toHaveBeenCalledWith(expect.anything(), '/v1/enquiries?limit=50', {
      revalidate: false,
    });
    expect(screen.getByLabelText('What is it about?')).toHaveValue('ENQUIRY_ISSUE');
    expect(screen.getByLabelText(/Which enquiry/)).toHaveValue(ENQUIRY_ID);
    expect(screen.queryByText(/priority/i)).toBeNull();
  });

  it('returns a signed-out visitor to the form, with what they had chosen', async () => {
    apiGetParsed.mockRejectedValue(await apiError(401, 'UNAUTHENTICATED'));
    expect(
      await redirectOf(() =>
        NewSupportRequestPage({
          searchParams: Promise.resolve({ category: 'DEALER_ISSUE', enquiry: 'not-an-id' }),
        }),
      ),
    ).toBe(`/login?returnTo=${encodeURIComponent('/support-requests/new?category=DEALER_ISSUE')}`);

    apiGetParsed.mockRejectedValue(new Error('boom'));
    await expect(NewSupportRequestPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'boom',
    );
  });
});

describe('SupportRequestForm', () => {
  it('asks for an enquiry only for the topics it helps, and opens the request it created', async () => {
    const submit = vi.fn().mockResolvedValue({ status: 'created', id: ID });
    const user = userEvent.setup();
    render(<SupportRequestForm enquiries={[ENQUIRY]} submit={submit} />);

    expect(screen.queryByLabelText(/Which enquiry/)).toBeNull();
    await user.selectOptions(screen.getByLabelText('What is it about?'), 'ACCOUNT_ISSUE');
    expect(screen.queryByLabelText(/Which enquiry/)).toBeNull();
    await user.selectOptions(screen.getByLabelText('What is it about?'), 'DEALER_ISSUE');
    await user.selectOptions(screen.getByLabelText(/Which enquiry/), ENQUIRY_ID);
    await user.type(screen.getByLabelText('Subject'), 'No call back');
    await user.type(screen.getByLabelText('Describe the issue'), 'Three days and no call.');
    expect(screen.getByText('23 / 5,000')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send request' }));

    expect(submit).toHaveBeenCalledWith({
      category: 'DEALER_ISSUE',
      subject: 'No call back',
      description: 'Three days and no call.',
      enquiryId: ENQUIRY_ID,
    });
    await waitFor(() => expect(navigationState.pushed).toEqual([`/support-requests/${ID}`]));
  });

  it('sends one request for a double press', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const submit = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    render(<SupportRequestForm enquiries={[]} initialCategory="OTHER" submit={submit as never} />);

    const form = screen.getByRole('button', { name: 'Send request' }).closest('form');
    if (!form) throw new Error('no form');
    form.requestSubmit();
    form.requestSubmit();
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    finish({ status: 'refused', message: 'Try later.' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Try later.');
  });

  it('shows each field’s error beside it, says when there is no enquiry, and sends a signed-out customer to log in', async () => {
    const submit = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'invalid',
        message: 'Check the highlighted fields and try again.',
        fieldErrors: { subject: 'Give your request a subject.', category: 'Choose a topic.' },
      })
      .mockResolvedValueOnce({ status: 'signed-out' });
    const user = userEvent.setup();
    render(<SupportRequestForm enquiries={[]} initialCategory="ENQUIRY_ISSUE" submit={submit} />);

    expect(screen.getByText('You have not sent any enquiries yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('Give your request a subject.')).toBeInTheDocument();
    expect(screen.getByLabelText('Subject')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('What is it about?')).toHaveAttribute('aria-invalid', 'true');

    await user.click(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() =>
      expect(navigationState.pushed).toEqual([
        `/login?returnTo=${encodeURIComponent('/support-requests/new')}`,
      ]),
    );
  });
});

describe('/support-requests/[id]', () => {
  it('shows the exact blocked message and urgent support route without a reply composer', async () => {
    apiGetParsed.mockResolvedValue(
      ticket({ canReply: false, remainingMessages: 0, status: 'OPEN' }),
    );
    render(await SupportRequestPage({ params: Promise.resolve({ id: ID }) }));
    expect(
      screen.getByText(
        "You've sent five messages. Please wait for our support team to reply before sending more.",
      ),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Contact support for urgent help' })).toHaveAttribute(
      'href',
      '/contact',
    );
    expect(screen.queryByRole('button', { name: 'Send reply' })).toBeNull();
    expect(screen.queryByText('This request is closed')).toBeNull();
  });
  it('shows the request, its enquiry and the conversation, with the reply box', async () => {
    apiGetParsed.mockResolvedValue(ticket());
    render(await SupportRequestPage({ params: Promise.resolve({ id: ID }) }));

    expect(apiGetParsed).toHaveBeenCalledWith(expect.anything(), `/v1/support/tickets/${ID}`, {
      revalidate: false,
    });
    expect(
      screen.getByRole('heading', { name: 'The dealer has not called me back' }),
    ).toBeInTheDocument();
    expect(screen.getByText('DD-1042')).toBeInTheDocument();
    const enquiry = screen.getByRole('region', { name: 'About your enquiry' });
    expect(enquiry).toHaveTextContent('2021 Honda City VX');
    expect(within(enquiry).getByRole('link', { name: 'View car' })).toHaveAttribute(
      'href',
      '/car/2021-honda-city-vx',
    );
    const bubbles = within(screen.getByRole('region', { name: 'Conversation' })).getAllByRole(
      'article',
    );
    expect(bubbles[0]).toHaveTextContent('You· Original request');
    expect(bubbles[1]).toHaveTextContent('Dealers-Drive support');
    expect(screen.getByText('We are waiting for your reply.')).toBeInTheDocument();
    expect(screen.getByLabelText('Reply to Dealers-Drive support')).toBeInTheDocument();
  });

  it('points a closed request at a new one, with no reply box', async () => {
    apiGetParsed.mockResolvedValue(
      ticket({ status: 'CLOSED', statusLabel: 'Closed', canReply: false, enquiry: null }),
    );
    render(await SupportRequestPage({ params: Promise.resolve({ id: ID }) }));
    expect(screen.getByText('This request is closed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a new request' })).toHaveAttribute(
      'href',
      '/support-requests/new',
    );
    expect(screen.queryByLabelText('Reply to Dealers-Drive support')).toBeNull();
  });

  it('says a reply reopens a resolved request', async () => {
    apiGetParsed.mockResolvedValue(
      ticket({
        status: 'RESOLVED',
        statusLabel: 'Resolved',
        enquiry: { ...ticket().enquiry!, vehicleHref: null },
      }),
    );
    render(await SupportRequestPage({ params: Promise.resolve({ id: ID }) }));
    expect(
      screen.getByText('This request is resolved. Replying will reopen it.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View car' })).toBeNull();
  });

  it('answers another customer’s request with the 404 page, and signs a stranger in', async () => {
    apiGetParsed.mockRejectedValue(await apiError(404, 'SUPPORT_TICKET_NOT_FOUND'));
    await expect(SupportRequestPage({ params: Promise.resolve({ id: ID }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    apiGetParsed.mockRejectedValue(await apiError(401, 'UNAUTHENTICATED'));
    expect(
      await redirectOf(() => SupportRequestPage({ params: Promise.resolve({ id: ID }) })),
    ).toBe(`/login?returnTo=${encodeURIComponent(`/support-requests/${ID}`)}`);
    apiGetParsed.mockRejectedValue(new Error('boom'));
    await expect(SupportRequestPage({ params: Promise.resolve({ id: ID }) })).rejects.toThrow(
      'boom',
    );
  });

  it('has a loading state', () => {
    render(<SupportRequestLoading />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });
});

describe('SupportReplyForm', () => {
  it('retains the reply UUID on network retry and replaces it after the text changes', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ status: 'refused', code: 'UNAVAILABLE', message: 'Try again.' });
    render(<SupportReplyForm ticketId={ID} hint={null} remainingMessages={4} send={send} />);
    const user = userEvent.setup();
    const input = screen.getByLabelText('Reply to Dealers-Drive support');
    await user.type(input, 'Retry text');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    await screen.findByText('Try again.');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls[1]?.[2]).toBe(send.mock.calls[0]?.[2]);
    await user.type(input, ' changed');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(3));
    expect(send.mock.calls[2]?.[2]).not.toBe(send.mock.calls[0]?.[2]);
    expect(screen.getByText('4 messages remaining before support replies.')).toBeVisible();
  });
  it('sends a reply, clears the box and refreshes the conversation', async () => {
    const send = vi.fn().mockResolvedValue({ status: 'sent' });
    const user = userEvent.setup();
    render(<SupportReplyForm ticketId={ID} hint={null} send={send} />);

    const button = screen.getByRole('button', { name: 'Send reply' });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText('Reply to Dealers-Drive support'), 'Here it is.');
    await user.click(button);
    expect(send).toHaveBeenCalledWith(ID, 'Here it is.', expect.stringMatching(/^[a-f0-9-]{36}$/));
    await waitFor(() => expect(navigationState.refreshed).toBe(1));
    expect(screen.getByLabelText('Reply to Dealers-Drive support')).toHaveValue('');
  });

  it('shows a refusal, and sends a signed-out customer to log in', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'refused',
        code: 'SUPPORT_TICKET_CLOSED',
        message: 'Closed.',
      })
      .mockResolvedValueOnce({ status: 'invalid', message: 'Too long.' })
      .mockResolvedValueOnce({ status: 'signed-out' });
    const user = userEvent.setup();
    render(<SupportReplyForm ticketId={ID} hint="We are waiting for your reply." send={send} />);
    const box = screen.getByLabelText('Reply to Dealers-Drive support');

    await user.type(box, 'One more thing');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Closed.');
    expect(box).toHaveAttribute('aria-invalid', 'true');

    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    expect(await screen.findByText('Too long.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    await waitFor(() =>
      expect(navigationState.pushed).toEqual([
        `/login?returnTo=${encodeURIComponent(`/support-requests/${ID}`)}`,
      ]),
    );
  });
});

describe('support Server Actions', () => {
  const DRAFT = {
    category: 'GENERAL_QUESTION',
    subject: 'A question',
    description: 'How do I compare two cars side by side?',
  };

  it('creates through the API and redraws the list', async () => {
    apiSend.mockResolvedValue(ticket());
    expect(await createSupportRequestAction({ ...DRAFT, enquiryId: ENQUIRY_ID })).toEqual({
      status: 'created',
      id: ID,
    });
    expect(apiSend).toHaveBeenCalledWith('POST', '/v1/support/tickets', {
      ...DRAFT,
      enquiryId: ENQUIRY_ID,
    });
    expect(revalidations.paths).toContain('/support-requests');
  });

  it('checks the draft before asking the API, field by field', async () => {
    const result = await createSupportRequestAction({ ...DRAFT, category: '', subject: 'Hi' });
    expect(result).toMatchObject({ status: 'invalid' });
    if (result.status !== 'invalid') throw new Error('expected invalid');
    expect(Object.keys(result.fieldErrors).sort()).toEqual(['category', 'subject']);
    expect(apiSend).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'UNAUTHENTICATED', { status: 'signed-out' }],
    [422, 'SUPPORT_ENQUIRY_INVALID', { status: 'refused', message: 'Choose one of yours.' }],
  ])('turns a %s from the API into a result', async (status, code, expected) => {
    apiSend.mockRejectedValue(await apiError(status, code, 'Choose one of yours.'));
    expect(await createSupportRequestAction(DRAFT)).toEqual(expected);
  });

  it('maps the API’s field errors, and says when the API is unreachable', async () => {
    apiSend.mockRejectedValue(
      await apiError(400, 'VALIDATION_FAILED', 'Invalid', [
        { field: 'body.subject', code: 'too_small', message: 'Too short.' },
      ]),
    );
    expect(await createSupportRequestAction(DRAFT)).toMatchObject({
      status: 'invalid',
      fieldErrors: { subject: 'Too short.' },
    });

    apiSend.mockRejectedValue(new TypeError('fetch failed'));
    expect(await createSupportRequestAction(DRAFT)).toMatchObject({ status: 'refused' });
  });

  it('replies through the API and redraws the request and the list', async () => {
    apiSend.mockResolvedValue(ticket());
    expect(await replySupportRequestAction(ID, ' Thanks ')).toEqual({ status: 'sent' });
    expect(apiSend).toHaveBeenCalledWith('POST', `/v1/support/tickets/${ID}/messages`, {
      message: 'Thanks',
    });
    expect(revalidations.paths).toEqual([`/support-requests/${ID}`, '/support-requests']);
  });

  it('refuses a reply it cannot send, without asking the API', async () => {
    expect(await replySupportRequestAction('not-an-id', 'Hi')).toMatchObject({ status: 'invalid' });
    expect(await replySupportRequestAction(ID, '   ')).toEqual({
      status: 'invalid',
      message: 'Write a message first.',
    });
    expect(apiSend).not.toHaveBeenCalled();
  });

  it('passes the API’s refusal on, and copes with the API being away', async () => {
    apiSend.mockRejectedValue(await apiError(409, 'SUPPORT_TICKET_CLOSED', 'It is closed.'));
    expect(await replySupportRequestAction(ID, 'Hi')).toEqual({
      status: 'refused',
      code: 'SUPPORT_TICKET_CLOSED',
      message: 'It is closed.',
    });
    apiSend.mockRejectedValue(await apiError(401, 'UNAUTHENTICATED'));
    expect(await replySupportRequestAction(ID, 'Hi')).toEqual({ status: 'signed-out' });
    apiSend.mockRejectedValue(new TypeError('fetch failed'));
    expect(await replySupportRequestAction(ID, 'Hi')).toMatchObject({
      status: 'refused',
      code: 'UNAVAILABLE',
    });
  });
});

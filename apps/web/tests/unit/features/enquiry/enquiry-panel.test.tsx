import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { navigationState, setLocation } from '../../../setup';

import { enquiryCustomerAction, sendEnquiryAction } from '@/features/enquiry/actions';
import { EnquiryPanel } from '@/features/enquiry/enquiry-panel';

/**
 * Enquire from the vehicle page (**R65**).
 *
 * The page is static, so who is signed in is asked only when somebody presses
 * Enquire — or returns from sign-in with `?enquire=1`. These pin the three
 * paths: anonymous goes to the Customer tab and comes back to this car; a
 * signed-in customer sees their own name and verified number, never a field
 * to type them into; and the answer is shown once, without a second send.
 */
vi.mock('@/features/enquiry/actions', () => ({
  enquiryCustomerAction: vi.fn(),
  sendEnquiryAction: vi.fn(),
}));

const CUSTOMER = { fullName: 'Shashikiran', phoneDisplay: '+91 98400 12345' };

const RECEIPT = {
  id: 'e1',
  status: 'NEW' as const,
  createdAt: '2026-09-28T10:30:00.000Z',
  dealerName: 'Sri Lakshmi Motors',
  vehicleTitle: '2023 Hyundai Creta SX(O)',
};

beforeEach(() => {
  vi.mocked(enquiryCustomerAction).mockReset();
  vi.mocked(sendEnquiryAction).mockReset();
  setLocation('/car/2023-hyundai-creta');
});

function panel(autoOpen = false) {
  return render(
    <EnquiryPanel
      listingSlug="2023-hyundai-creta"
      dealerName="Sri Lakshmi Motors"
      autoOpen={autoOpen}
    />,
  );
}

async function pressEnquire(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole('button', { name: 'Enquire now' })[0]!);
}

describe('an anonymous visitor', () => {
  it('is sent to the Customer tab, and told to come back to this car', async () => {
    const user = userEvent.setup();
    vi.mocked(enquiryCustomerAction).mockResolvedValue(null);
    panel();

    await pressEnquire(user);

    await waitFor(() => {
      expect(navigationState.pushed).toEqual([
        '/login?returnTo=%2Fcar%2F2023-hyundai-creta%3Fenquire%3D1',
      ]);
    });
    expect(sendEnquiryAction).not.toHaveBeenCalled();
  });
});

describe('a signed-in customer', () => {
  it('sees their own name and verified mobile, with nothing to type them into', async () => {
    const user = userEvent.setup();
    vi.mocked(enquiryCustomerAction).mockResolvedValue(CUSTOMER);
    panel();

    await pressEnquire(user);

    expect(await screen.findByText('Shashikiran')).toBeInTheDocument();
    expect(screen.getByText('+91 98400 12345')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /name/i })).toBeNull();
    expect(screen.queryByRole('textbox', { name: /mobile/i })).toBeNull();
    expect(screen.getByRole('textbox', { name: /message/i })).toHaveValue('');
  });

  it('sends with no message at all', async () => {
    const user = userEvent.setup();
    vi.mocked(enquiryCustomerAction).mockResolvedValue(CUSTOMER);
    vi.mocked(sendEnquiryAction).mockResolvedValue({ status: 'sent', receipt: RECEIPT });
    panel();

    await pressEnquire(user);
    await user.click(await screen.findByRole('button', { name: 'Send enquiry' }));

    expect(await screen.findByText('Enquiry sent')).toBeInTheDocument();
    expect(
      screen.getByText('Sri Lakshmi Motors has received your contact request.', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Track it in My enquiries' })).toHaveAttribute(
      'href',
      '/enquiries',
    );
    expect(sendEnquiryAction).toHaveBeenCalledWith('2023-hyundai-creta', '');
  });

  it('sends the message they typed', async () => {
    const user = userEvent.setup();
    vi.mocked(enquiryCustomerAction).mockResolvedValue(CUSTOMER);
    vi.mocked(sendEnquiryAction).mockResolvedValue({ status: 'sent', receipt: RECEIPT });
    panel();

    await pressEnquire(user);
    await user.type(
      await screen.findByRole('textbox', { name: /message/i }),
      'Can I visit tomorrow?',
    );
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));

    await screen.findByText('Enquiry sent');
    expect(sendEnquiryAction).toHaveBeenCalledWith('2023-hyundai-creta', 'Can I visit tomorrow?');
  });

  /** A double-tap on a slow phone sends once. */
  it('sends once, however many times Send is pressed while it is sending', async () => {
    const user = userEvent.setup();
    vi.mocked(enquiryCustomerAction).mockResolvedValue(CUSTOMER);
    let release: (value: { status: 'sent'; receipt: typeof RECEIPT }) => void = () => undefined;
    vi.mocked(sendEnquiryAction).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    panel();

    await pressEnquire(user);
    const send = await screen.findByRole('button', { name: 'Send enquiry' });
    await user.click(send);
    await user.click(send);
    await user.click(send);
    release({ status: 'sent', receipt: RECEIPT });

    await screen.findByText('Enquiry sent');
    expect(sendEnquiryAction).toHaveBeenCalledTimes(1);
  });

  it('says so when the car sold in the meantime', async () => {
    const user = userEvent.setup();
    vi.mocked(enquiryCustomerAction).mockResolvedValue(CUSTOMER);
    vi.mocked(sendEnquiryAction).mockResolvedValue({
      status: 'refused',
      code: 'LISTING_NOT_AVAILABLE',
      message: 'This car is no longer available.',
    });
    panel();

    await pressEnquire(user);
    await user.click(await screen.findByRole('button', { name: 'Send enquiry' }));

    expect(await screen.findByText('This car is no longer available')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send enquiry' })).toBeNull();
  });

  /** R68: one open enquiry per car — the customer is pointed at where to follow it. */
  it('says so when they already have an open enquiry, and offers no second send', async () => {
    const user = userEvent.setup();
    vi.mocked(enquiryCustomerAction).mockResolvedValue(CUSTOMER);
    vi.mocked(sendEnquiryAction).mockResolvedValue({
      status: 'refused',
      code: 'ENQUIRY_ALREADY_OPEN',
      message: 'You already have an enquiry about this car.',
    });
    panel();

    await pressEnquire(user);
    await user.click(await screen.findByRole('button', { name: 'Send enquiry' }));

    expect(
      await screen.findByText('You already have an enquiry about this car'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send enquiry' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Track it in My enquiries' })).toHaveAttribute(
      'href',
      '/enquiries',
    );
  });

  it('is sent to sign in again when the session ended mid-way', async () => {
    const user = userEvent.setup();
    vi.mocked(enquiryCustomerAction).mockResolvedValue(CUSTOMER);
    vi.mocked(sendEnquiryAction).mockResolvedValue({ status: 'signed-out' });
    panel();

    await pressEnquire(user);
    await user.click(await screen.findByRole('button', { name: 'Send enquiry' }));

    await waitFor(() => {
      expect(navigationState.pushed[0]).toMatch(/^\/login\?returnTo=/);
    });
  });
});

describe('the requires-login hint (R68)', () => {
  it('tells somebody not signed in that enquiring needs a login', async () => {
    vi.mocked(enquiryCustomerAction).mockResolvedValue(null);
    panel();

    await waitFor(() => {
      expect(enquiryCustomerAction).toHaveBeenCalledTimes(1);
    });
    expect(screen.getAllByText('Requires login with your mobile number')).toHaveLength(2);
  });

  it('drops the hint for a customer who is already signed in', async () => {
    vi.mocked(enquiryCustomerAction).mockResolvedValue(CUSTOMER);
    panel();

    await waitFor(() => {
      expect(screen.queryByText('Requires login with your mobile number')).toBeNull();
    });
    expect(enquiryCustomerAction).toHaveBeenCalledTimes(1);
  });
});

describe('coming back from sign-in', () => {
  /** `?enquire=1` reopens the form: the customer does not press Enquire twice. */
  it('opens the form by itself, prefilled', async () => {
    vi.mocked(enquiryCustomerAction).mockResolvedValue(CUSTOMER);
    panel(true);

    expect(await screen.findByRole('button', { name: 'Send enquiry' })).toBeInTheDocument();
    expect(screen.getByText('Shashikiran')).toBeInTheDocument();
  });

  it('drops ?enquire=1 once the enquiry is sent, so a reload does not reopen it', async () => {
    const user = userEvent.setup();
    vi.mocked(enquiryCustomerAction).mockResolvedValue(CUSTOMER);
    vi.mocked(sendEnquiryAction).mockResolvedValue({ status: 'sent', receipt: RECEIPT });
    panel(true);

    await user.click(await screen.findByRole('button', { name: 'Send enquiry' }));

    await screen.findByText('Enquiry sent');
    expect(navigationState.replaced).toEqual(['/car/2023-hyundai-creta']);
  });
});

/**
 * The account check or the send failing outright — the network, the server
 * action itself — is not a crash and not a spinner that never stops: the panel
 * says so in its own words and the button is there to press again.
 */
describe('when the service cannot be reached', () => {
  it('says the form could not be opened, and lets the buyer try again', async () => {
    const user = userEvent.setup();
    vi.mocked(enquiryCustomerAction).mockResolvedValueOnce(null);
    vi.mocked(enquiryCustomerAction).mockRejectedValueOnce(new Error('fetch failed ECONNREFUSED'));
    panel();

    await pressEnquire(user);

    const alert = await screen.findByText('We couldn’t open the enquiry form');
    expect(alert).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('ECONNREFUSED');
    expect(screen.getAllByRole('button', { name: 'Enquire now' })[0]).toBeEnabled();

    vi.mocked(enquiryCustomerAction).mockResolvedValueOnce(CUSTOMER);
    await pressEnquire(user);
    await waitFor(() => {
      expect(screen.queryByText('We couldn’t open the enquiry form')).not.toBeInTheDocument();
    });
  });

  it('keeps the form and says the enquiry was not sent when the send itself fails', async () => {
    const user = userEvent.setup();
    vi.mocked(enquiryCustomerAction).mockResolvedValue(CUSTOMER);
    vi.mocked(sendEnquiryAction).mockRejectedValue(new Error('TypeError: fetch failed'));
    panel();

    await pressEnquire(user);
    await user.click(await screen.findByRole('button', { name: 'Send enquiry' }));

    expect(
      await screen.findByText('We couldn’t send your enquiry right now. Please try again.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('TypeError');
    expect(screen.getByRole('button', { name: 'Send enquiry' })).toBeInTheDocument();
  });
});

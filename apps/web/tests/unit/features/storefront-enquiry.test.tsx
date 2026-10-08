import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WebsiteEnquiry } from '@/features/storefront-enquiry/website-enquiry';
import { sendWebsiteEnquiryAction } from '@/features/storefront-enquiry/actions';
import { ApiError, apiSend } from '@/lib/api';
import type * as apiModule from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof apiModule>();
  return { ...actual, apiSend: vi.fn() };
});
const ticket = 'eyJ0ZXN0IjoidGVzdCJ9.signature0123456789';
const context = {
  dealerName: 'Alpha Motors',
  vehicleTitle: 'Honda City',
  returnUrl: 'https://alpha.example.com/car/honda-city',
};
const customer = { fullName: 'Synthetic Customer', phoneDisplay: '+91 98400 99992' };
beforeEach(() => {
  vi.mocked(apiSend).mockReset();
});

describe('verified dealership enquiry handoff', () => {
  it('requires explicit consent and sends no client-asserted identity', async () => {
    const form = new FormData();
    expect((await sendWebsiteEnquiryAction(ticket, { status: 'idle' }, form)).status).toBe('error');
    expect(apiSend).not.toHaveBeenCalled();
    form.set('consent', 'on');
    form.set('message', 'May I visit?');
    form.set('dealerId', 'other-dealer');
    form.set('customerPhone', 'unverified');
    vi.mocked(apiSend).mockResolvedValue({
      id: 'receipt',
      status: 'NEW',
      dealerName: context.dealerName,
      vehicleTitle: context.vehicleTitle,
      createdAt: '2026-10-08',
    });
    expect((await sendWebsiteEnquiryAction(ticket, { status: 'idle' }, form)).status).toBe('sent');
    expect(apiSend).toHaveBeenCalledWith('POST', '/v1/enquiries/storefront', {
      ticket,
      message: 'May I visit?',
      consent: true,
    });
  });
  it('returns safe errors for sold cars and unavailable APIs', async () => {
    const form = new FormData();
    form.set('consent', 'on');
    vi.mocked(apiSend).mockRejectedValue(
      new ApiError({
        type: 'about:blank',
        title: 'Unavailable',
        status: 404,
        code: 'NOT_FOUND',
        detail: 'This car is unavailable.',
      }),
    );
    expect(await sendWebsiteEnquiryAction(ticket, { status: 'idle' }, form)).toMatchObject({
      status: 'error',
      message: 'This car is unavailable.',
    });
    vi.mocked(apiSend).mockRejectedValue(new Error('secret network detail'));
    expect(
      (await sendWebsiteEnquiryAction(ticket, { status: 'idle' }, form)).message,
    ).not.toContain('secret');
  });
  it('renders verified identity, labelled consent and meaningful success', async () => {
    vi.mocked(apiSend).mockResolvedValue({
      id: 'receipt',
      status: 'NEW',
      dealerName: context.dealerName,
      vehicleTitle: context.vehicleTitle,
      createdAt: '2026-10-08',
    });
    render(<WebsiteEnquiry ticket={ticket} context={context} customer={customer} />);
    expect(screen.getByText(customer.phoneDisplay)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeRequired();
    expect(screen.getByRole('link', { name: 'Privacy information' })).toHaveAttribute(
      'href',
      'https://alpha.example.com/privacy',
    );
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.submit(screen.getByRole('form', { name: 'Website vehicle enquiry' }));
    await waitFor(() => expect(screen.getByText('Your enquiry has been sent')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Return to the car' })).toHaveAttribute(
      'href',
      context.returnUrl,
    );
  });
});

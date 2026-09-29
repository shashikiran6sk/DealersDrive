import type { SupportContacts } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SupportPage } from '@/features/support/support-page';

/**
 * The Contact & support page (`/contact`). Every address, number and chat link
 * on it comes from `GET /v1/config/public`, which an operator edits in
 * `/admin/config`; the page composes nothing of its own. What is asserted is
 * that it links exactly what it was given, and that an unconfigured WhatsApp
 * chat is shown as unavailable rather than as a dead link.
 */
const SUPPORT: SupportContacts = {
  customer: { email: 'help@example.org', phone: '+91 98400 12345' },
  dealer: { email: 'dealers@example.org', phone: '044-2345-6789' },
  whatsappHref: 'https://wa.me/919840012345',
};

function card(name: string): HTMLElement {
  return screen.getByRole('article', { name });
}

describe('SupportPage', () => {
  it('links the customer contacts it was given', () => {
    render(<SupportPage support={SUPPORT} />);

    const links = within(card('Customer support')).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'mailto:help@example.org',
      'tel:+919840012345',
    ]);
  });

  it('links the dealer contacts it was given', () => {
    render(<SupportPage support={SUPPORT} />);

    const links = within(card('Dealer support')).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'mailto:dealers@example.org',
      'tel:04423456789',
    ]);
  });

  it('opens a configured WhatsApp chat in a new tab without leaking the referrer', () => {
    render(<SupportPage support={SUPPORT} />);

    const chat = within(card('Chat on WhatsApp')).getByRole('link', { name: /chat in whatsapp/i });
    expect(chat).toHaveAttribute('href', 'https://wa.me/919840012345');
    expect(chat).toHaveAttribute('target', '_blank');
    expect(chat.getAttribute('rel')).toContain('noopener');
    expect(chat.getAttribute('rel')).toContain('noreferrer');
  });

  it('shows the chat as unavailable, not as a link, until one is configured', () => {
    render(<SupportPage support={{ ...SUPPORT, whatsappHref: null }} />);

    const whatsapp = card('Chat on WhatsApp');
    expect(within(whatsapp).queryByRole('link')).toBeNull();
    expect(within(whatsapp).getByText('Chat in WhatsApp')).toHaveAttribute('aria-disabled', 'true');
    expect(within(whatsapp).getByText(/not available yet/i)).toBeInTheDocument();
  });

  it('omits a contact it was not given rather than linking nothing', () => {
    render(
      <SupportPage
        support={{ ...SUPPORT, customer: { email: '', phone: '' }, whatsappHref: null }}
      />,
    );

    expect(within(card('Customer support')).queryByRole('link')).toBeNull();
  });
});

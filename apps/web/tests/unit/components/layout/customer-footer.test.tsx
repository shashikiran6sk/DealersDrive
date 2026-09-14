import type { SocialLink } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CustomerFooter } from '@/components/layout/customer-footer';

/**
 * The buyer footer (**R44**).
 *
 * It moved out of `customer-header.test.tsx` when it stopped being four links
 * in a row: a file about a nav bar carrying two assertions about a footer was
 * fine, and carrying a dozen would be a file about neither.
 *
 * What is asserted here is the part a wrong implementation gets wrong quietly:
 * which destinations it claims exist, that an unconfigured social account
 * produces **no link at all** rather than a dead one, and that a support
 * contact the API could not supply is absent rather than rendered as an empty
 * `mailto:`. Nothing here pins a colour, a gap or the width at which the
 * columns stack — that is the sandbox's job.
 */
const SOCIAL: SocialLink[] = [
  { network: 'instagram', label: 'Instagram', href: 'https://instagram.com/dealersdrive' },
  { network: 'youtube', label: 'YouTube', href: 'https://youtube.com/@dealersdrive' },
];

function renderFooter(props: Partial<Parameters<typeof CustomerFooter>[0]> = {}) {
  return render(
    <CustomerFooter
      social={props.social ?? SOCIAL}
      supportEmail={props.supportEmail ?? 'support@dealers-drive.com'}
      supportPhone={props.supportPhone ?? '+914162248890'}
    />,
  );
}

/** Every anchor in one named column, as hrefs. */
function columnHrefs(name: string): (string | null)[] {
  const column = screen.getByRole('navigation', { name });
  return Array.from(column.querySelectorAll('a')).map((link) => link.getAttribute('href'));
}

describe('the sentence the marketplace rests on', () => {
  /**
   * The footer's oldest job, and the reason it is on every public page rather
   * than in a terms document nobody opens: Dealers-Drive verifies who the
   * dealer is, and does not sell the car.
   */
  it('survives the redesign', () => {
    renderFooter();

    expect(screen.getByText(/owned, priced and warranted by the dealer/i)).toBeInTheDocument();
  });

  it('says the platform is not a party to the sale', () => {
    renderFooter();

    expect(screen.getByText(/not a party to any sale/i)).toBeInTheDocument();
  });
});

describe('the destinations it claims exist', () => {
  /**
   * **The rule this file exists to hold.** The footer offers exactly what
   * `CustomerHeader` offers and invents nothing — no About, no Terms, no
   * Careers page to fill a column out. A footer link onto a 404 is the product
   * telling a buyer a page exists and then not having it.
   */
  it('offers the three buyer sections the header does', () => {
    renderFooter();

    expect(columnHrefs('Buy a car')).toEqual(['/cars', '/dealers', '/saved']);
  });

  /** One door (**R35**) — the console decides between sign-in and onboarding. */
  it('offers one dealer door, at /dealer', () => {
    renderFooter();

    expect(columnHrefs('For dealers')).toEqual(['/dealer']);
  });

  it('invents no page that does not exist', () => {
    renderFooter();

    const routes = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href') ?? '')
      .filter((href) => href.startsWith('/'));

    expect(new Set(routes)).toEqual(new Set(['/cars', '/dealers', '/saved', '/dealer']));
  });
});

describe('the social row', () => {
  it('renders one labelled link per configured network', () => {
    renderFooter();
    const row = screen.getByRole('navigation', { name: /social media/i });

    expect(within(row).getByRole('link', { name: /on Instagram/i })).toHaveAttribute(
      'href',
      'https://instagram.com/dealersdrive',
    );
    expect(within(row).getAllByRole('link')).toHaveLength(2);
  });

  /**
   * The important half. A fresh deployment has published no accounts, and a
   * hard-coded default would link a buyer to a platform's own homepage — which
   * is worse than an absent row, not better.
   */
  it('disappears entirely when nothing is configured', () => {
    renderFooter({ social: [] });

    expect(screen.queryByRole('navigation', { name: /social media/i })).not.toBeInTheDocument();
  });

  /**
   * These are the only outbound links on a buyer page, and the referring URL
   * can carry a search a buyer ran.
   */
  it('opens outbound links without leaking the page they came from', () => {
    renderFooter();

    for (const link of within(
      screen.getByRole('navigation', { name: /social media/i }),
    ).getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(link.getAttribute('rel')).toContain('noreferrer');
    }
  });
});

describe('the support contacts', () => {
  it('links the address and the number the API supplied', () => {
    renderFooter();

    expect(columnHrefs('Support')).toEqual([
      'mailto:support@dealers-drive.com',
      'tel:+914162248890',
    ]);
  });

  /**
   * `NO_PUBLIC_CONFIG` — what the layout degrades to when the API cannot be
   * reached. An empty `mailto:` is a link that opens a blank draft, which is
   * worse than no link: it looks like the product working.
   */
  it('omits a contact the API could not supply, rather than linking nothing', () => {
    renderFooter({ supportEmail: '', supportPhone: '' });

    expect(columnHrefs('Support')).toEqual([]);
  });
});

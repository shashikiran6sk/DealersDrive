import { render, screen, within } from '@testing-library/react';
import Link from 'next/link';
import { describe, expect, it } from 'vitest';

import { linkStatus, setLocation } from '../../../setup';

import { ConsoleNav, LANDED_NAV } from '@/components/dealer/console-nav';
import { ButtonLink } from '@/components/ui/button';
import { LinkPendingIndicator, LinkPendingLabel } from '@/components/ui/link-pending';

/**
 * A click on a link to a server-rendered page used to look like nothing
 * happened until the whole page arrived. Every link the console, the header
 * and the cards draw now says, at once, that it is on its way — with the same
 * 14px spinner `Button loading` already uses.
 */
describe('LinkPendingIndicator', () => {
  it('draws nothing while the link is idle', () => {
    render(
      <Link href="/dealer/inventory">
        Inventory <LinkPendingIndicator />
      </Link>,
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('can reserve its space while idle, so the label does not move when it appears', () => {
    const { container } = render(
      <Link href="/dealer/inventory">
        Inventory <LinkPendingIndicator reserve />
      </Link>,
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.querySelector('span[aria-hidden="true"]')).toHaveClass('size-[14px]');
  });

  it('shows the button spinner, announced, while the navigation is pending', () => {
    linkStatus.pending = true;
    render(
      <Link href="/dealer/inventory">
        Inventory <LinkPendingIndicator />
      </Link>,
    );
    const status = screen.getByRole('status', { name: 'Loading' });
    expect(status).toHaveAttribute('data-pending');
    expect(status.querySelector('svg.animate-spin')).not.toBeNull();
  });
});

describe('LinkPendingLabel', () => {
  it('keeps the label in place, hidden, under the spinner, so the button keeps its width', () => {
    linkStatus.pending = true;
    render(<ButtonLink href="/cars">View all →</ButtonLink>);

    const link = screen.getByRole('link');
    expect(link).toHaveClass('relative');
    expect(within(link).getByText('View all →')).toHaveClass('invisible');
    expect(within(link).getByRole('status', { name: 'Loading' })).toHaveClass('absolute');
  });

  it('is just the label while idle', () => {
    render(
      <Link href="/cars">
        <LinkPendingLabel>Browse every car</LinkPendingLabel>
      </Link>,
    );
    expect(screen.getByRole('link', { name: 'Browse every car' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('ConsoleNav while a section loads', () => {
  it('puts a spinner in the item being opened and keeps the sidebar as it is', () => {
    setLocation('/dealer');
    linkStatus.pending = true;
    render(<ConsoleNav items={LANDED_NAV} />);

    const inventory = screen.getByRole('link', { name: /Inventory/ });
    expect(within(inventory).getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(LANDED_NAV.length);
  });
});

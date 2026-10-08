import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MobileNav } from '@/components/layout/mobile-nav';

import { setLocation } from '../../../setup';

const items = [
  { href: '/dealer', label: 'Dashboard' },
  { href: '/dealer/inventory', label: 'Inventory' },
  { href: '/dealer/team', label: 'Team' },
];
const listeners = new Set<() => void>();
const media = {
  matches: false,
  addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
  removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
};

function Nav({ allowed = items }: { allowed?: typeof items }) {
  return <MobileNav items={allowed} label="Dealer console" rootHref="/dealer" />;
}

beforeEach(() => {
  setLocation('/dealer/inventory');
  media.matches = false;
  vi.stubGlobal('matchMedia', () => media);
});

afterEach(() => {
  listeners.clear();
  vi.unstubAllGlobals();
});

describe('MobileNav', () => {
  it('opens all supplied destinations, highlights the active page, and returns focus on Escape', async () => {
    const user = userEvent.setup();
    render(<Nav />);
    const trigger = screen.getByRole('button', { name: 'Open Dealer console menu' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Dealer console' });
    expect(within(dialog).getAllByRole('link')).toHaveLength(items.length);
    expect(within(dialog).getByRole('link', { name: 'Inventory' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(dialog).toContainElement(
      document.activeElement instanceof HTMLElement ? document.activeElement : null,
    );
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('closes on navigation and never adds items beyond the permission-filtered list', async () => {
    const user = userEvent.setup();
    render(<Nav allowed={[items[0]!]} />);
    await user.click(screen.getByRole('button', { name: 'Open Dealer console menu' }));
    expect(screen.queryByRole('link', { name: 'Team' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('releases the open drawer on a route change or resize to the desktop sidebar', async () => {
    const user = userEvent.setup();
    const view = render(<Nav />);
    await user.click(screen.getByRole('button', { name: 'Open Dealer console menu' }));
    setLocation('/dealer/team');
    view.rerender(<Nav />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open Dealer console menu' }));
    act(() => {
      media.matches = true;
      listeners.forEach((listener) => listener());
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

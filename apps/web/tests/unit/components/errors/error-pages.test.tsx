import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import DealerConsoleError from '@/app/(dealer)/error';
import CarsError from '@/app/(public)/cars/error';
import DealerError from '@/app/(public)/dealers/[slug]/error';
import PublicError from '@/app/(public)/error';
import GlobalError from '@/app/global-error';
import NotFound, { metadata as notFoundMetadata } from '@/app/not-found';
import { SectionError } from '@/components/errors/section-error';
import { NotFoundState } from '@/components/errors/status-page';
import { PublicShell } from '@/components/layout/public-shell';

import { navigationState } from '../../../setup';

vi.mock('next/font/local', () => ({ default: () => ({ variable: 'font-manrope' }) }));

/**
 * The branded 404 and error screens. What is pinned here is what a restyle
 * cannot break and a careless edit can: the headings and the two ways out,
 * that nothing the error carried reaches the page, and that "Try again" asks
 * the server again rather than re-rendering the same failure.
 */
const LEAKY = Object.assign(
  new Error('connect ECONNREFUSED 127.0.0.1:4000 — PrismaClientInitializationError at db.internal'),
  { digest: '2417890331' },
);

describe('the 404 page', () => {
  it('says the page was not found and offers the homepage and the cars', () => {
    render(<NotFoundState />);

    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to homepage' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Browse cars' })).toHaveAttribute('href', '/cars');
  });

  it('is drawn inside the public header and footer, and titled for what it is', () => {
    const tree = NotFound();
    expect(tree.type).toBe(PublicShell);
    expect(notFoundMetadata.title).toBe('Page not found');
  });
});

describe('the error page', () => {
  it('says something went wrong in its own words, never the error’s', () => {
    render(<PublicError error={LEAKY} reset={vi.fn()} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/ECONNREFUSED|Prisma|db\.internal|4000/);
  });

  it('quotes the digest as a reference, which the server log carries too', () => {
    render(<PublicError error={LEAKY} reset={vi.fn()} />);
    expect(screen.getByText('2417890331')).toBeInTheDocument();
  });

  it('shows no reference when there is none to quote', () => {
    render(<PublicError error={new Error('x')} reset={vi.fn()} />);
    expect(screen.queryByText(/Reference/)).not.toBeInTheDocument();
  });

  it('asks the server again and resets the boundary on "Try again"', async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<PublicError error={LEAKY} reset={reset} />);

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(navigationState.refreshed).toBe(1);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Go to homepage' })).toHaveAttribute('href', '/');
  });

  it('keeps itself out of the index and out of the page title', () => {
    render(<PublicError error={LEAKY} reset={vi.fn()} />);

    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    expect(document.title).toBe('Something went wrong | Dealers-Drive');
  });

  it('names what failed on the routes that have their own boundary', () => {
    const { unmount } = render(<CarsError error={LEAKY} reset={vi.fn()} />);
    expect(
      screen.getByText('We couldn’t load the vehicles right now. Please try again.'),
    ).toBeInTheDocument();
    unmount();

    render(<DealerError error={LEAKY} reset={vi.fn()} />);
    expect(
      screen.getByText('We couldn’t load this dealership right now. Please try again.'),
    ).toBeInTheDocument();
  });

  it('sends a dealer back to the dashboard, not the marketplace', () => {
    render(<DealerConsoleError error={LEAKY} reset={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Back to the dashboard' })).toHaveAttribute(
      'href',
      '/dealer',
    );
    expect(document.body.textContent).not.toMatch(/ECONNREFUSED|Prisma/);
  });

  it('brings its own document when even the root layout failed', () => {
    const tree = GlobalError({ error: LEAKY, reset: vi.fn() });
    expect(tree.type).toBe('html');
    expect((tree.props as { lang?: string }).lang).toBe('en');
  });
});

describe('a section that failed', () => {
  it('says so where the section was, and offers to try again', async () => {
    const user = userEvent.setup();
    render(
      <SectionError
        title="We couldn’t load these vehicles right now"
        message="Please try again."
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('We couldn’t load these vehicles right now');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(navigationState.refreshed).toBe(1);
  });
});

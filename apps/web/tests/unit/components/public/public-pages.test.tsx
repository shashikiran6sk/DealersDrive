import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from '@/app/(public)/page';
import SavedCarsPage from '@/app/(public)/saved/page';

describe('the public home page', () => {
  it('explains the marketplace without claiming unfinished features are live', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('heading', { name: /a clearer way to find your next car/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/the dealer directory and the car marketplace are live/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/search, saving and enquiries are the next features/i),
    ).toBeInTheDocument();
  });

  it('sends buyers to the car marketplace', () => {
    render(<HomePage />);
    expect(screen.getByRole('link', { name: 'Browse used cars' })).toHaveAttribute('href', '/cars');
  });

  it('sends buyers to the live dealer directory', () => {
    render(<HomePage />);

    for (const link of screen.getAllByRole('link', {
      name: /verified dealers|dealer directory/i,
    })) {
      expect(link).toHaveAttribute('href', '/dealers');
    }
  });
});

describe('unfinished buyer features', () => {
  it.each([[SavedCarsPage, /save the cars you love — coming soon/i]])(
    'renders a useful coming-soon page',
    (Page, heading) => {
      render(<Page />);

      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /explore verified dealers/i })).toHaveAttribute(
        'href',
        '/dealers',
      );
      expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
    },
  );
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SavedCarsPage from '@/app/(public)/saved/page';

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

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DealerGallery } from '@/components/dealers/dealer-gallery';

/**
 * #299 — the gallery draws what the API calls approved and nothing else. It
 * has no status to read: a pending photograph never reaches `portfolio`.
 */
describe('DealerGallery', () => {
  it('names each photograph by its caption, and captions the ones that have one', () => {
    render(
      <DealerGallery
        brandName="Sri Lakshmi Motors"
        photos={[
          { url: 'https://media.test/portfolio/1.webp', caption: 'Showroom at dusk' },
          { url: 'https://media.test/portfolio/2.webp', caption: null },
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Photos of the dealership' })).toBeInTheDocument();
    expect(screen.getByAltText('Sri Lakshmi Motors — Showroom at dusk')).toHaveAttribute(
      'src',
      'https://media.test/portfolio/1.webp',
    );
    expect(screen.getByAltText('Sri Lakshmi Motors dealership, photo 2')).toBeInTheDocument();
    expect(screen.getByText('Showroom at dusk').tagName).toBe('FIGCAPTION');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders nothing at all when there is nothing approved', () => {
    const { container } = render(<DealerGallery brandName="Sri Lakshmi Motors" photos={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

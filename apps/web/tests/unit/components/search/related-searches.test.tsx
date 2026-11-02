import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RelatedSearches } from '@/components/search/related-searches';

const GROUPS = [
  {
    title: 'Popular searches in Arcot',
    links: [
      { href: '/used-cars/arcot/diesel', label: 'Used Diesel Cars in Arcot' },
      { href: '/used-cars/arcot/suv', label: 'Used SUV Cars in Arcot' },
    ],
  },
  { title: 'Towns in Ranipet district', links: [] },
];

describe('RelatedSearches', () => {
  it('is a named region of plain links, under each group’s title', () => {
    render(<RelatedSearches heading="More used cars around Arcot" groups={GROUPS} />);
    const region = within(screen.getByRole('region', { name: 'More used cars around Arcot' }));

    expect(region.getByRole('heading', { level: 2 }).textContent).toBe(
      'More used cars around Arcot',
    );
    expect(region.getByRole('heading', { level: 3 }).textContent).toBe('Popular searches in Arcot');
    expect(region.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/used-cars/arcot/diesel',
      '/used-cars/arcot/suv',
    ]);
    expect(region.getByRole('link', { name: 'Used SUV Cars in Arcot' })).toBeInTheDocument();
  });

  it('leaves out a group with no links', () => {
    render(<RelatedSearches heading="More used cars around Arcot" groups={GROUPS} />);
    expect(screen.queryByText('Towns in Ranipet district')).toBeNull();
  });

  it('renders nothing at all when there is nothing to link', () => {
    const { container } = render(
      <RelatedSearches
        heading="More used cars around Arcot"
        groups={[{ title: 'Popular searches in Arcot', links: [] }]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

import { fireEvent, render, screen, within } from '@testing-library/react';
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

describe('RelatedSearches, collapsible', () => {
  const MANY = [
    {
      title: 'Popular searches in Vellore',
      links: [
        { href: '/used-cars/vellore/hyundai', label: 'Used Hyundai Cars in Vellore' },
        { href: '/used-cars/vellore/diesel', label: 'Used Diesel Cars in Vellore' },
      ],
    },
    {
      title: 'Towns in Vellore district',
      links: [{ href: '/used-cars/katpadi', label: 'Used Cars in Katpadi' }],
    },
  ];

  function renderCollapsible() {
    return render(
      <RelatedSearches heading="More used cars around Vellore" groups={MANY} collapsible />,
    );
  }

  it('starts as a clipped row, with every link already in the page for crawlers', () => {
    renderCollapsible();
    const region = within(screen.getByRole('region', { name: 'More used cars around Vellore' }));
    expect(region.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/used-cars/vellore/hyundai',
      '/used-cars/vellore/diesel',
      '/used-cars/katpadi',
    ]);
    const toggle = region.getByRole('button', { name: 'See more' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(panel?.className).toContain('max-h-[76px]');
  });

  it('opens into the titled groups with See more, and closes again with See less', () => {
    renderCollapsible();
    fireEvent.click(screen.getByRole('button', { name: 'See more' }));

    const toggle = screen.getByRole('button', { name: 'See less' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('heading', { level: 3, name: 'Towns in Vellore district' }),
    ).toHaveClass('eyebrow');
    expect(
      screen.getByRole('heading', { level: 3, name: 'Towns in Vellore district' }),
    ).not.toHaveClass('sr-only');

    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'See more' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  function placeAt(element: Element, bottom: number) {
    element.getBoundingClientRect = () => ({ bottom }) as DOMRect;
  }

  it('opens when a clipped link is reached by keyboard, keeping focus on that link', () => {
    renderCollapsible();
    const panel = document.getElementById(
      screen.getByRole('button', { name: 'See more' }).getAttribute('aria-controls') ?? '',
    );
    const katpadi = screen.getByRole('link', { name: 'Used Cars in Katpadi' });
    if (panel) placeAt(panel, 76);
    placeAt(katpadi, 120);
    katpadi.focus();
    fireEvent.focus(katpadi);

    expect(screen.getByRole('button', { name: 'See less' })).toBeInTheDocument();
    expect(document.activeElement).toBe(katpadi);
  });

  it('stays collapsed when a visible link takes focus, so a click on it navigates', () => {
    renderCollapsible();
    const panel = document.getElementById(
      screen.getByRole('button', { name: 'See more' }).getAttribute('aria-controls') ?? '',
    );
    const hyundai = screen.getByRole('link', { name: 'Used Hyundai Cars in Vellore' });
    if (panel) placeAt(panel, 76);
    placeAt(hyundai, 34);
    hyundai.focus();
    fireEvent.focus(hyundai);

    expect(screen.getByRole('button', { name: 'See more' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});

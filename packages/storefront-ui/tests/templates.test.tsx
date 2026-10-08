import { fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  StorefrontAbout,
  StorefrontContact,
  StorefrontHome,
  StorefrontInventory,
  StorefrontShell,
  StorefrontVehicle,
  accentForeground,
  responsiveImageSet,
} from '../src/index.js';
import { StorefrontImage } from '../src/components/storefront-image/storefront-image.js';
import { CAR, CARD, INVENTORY, SITE } from './fixtures.js';

describe.each(['LIGHT', 'DARK'] as const)('%s presentation and accessibility', (theme) => {
  it('shows one dealer, semantic navigation, heading and factual verification only', () => {
    const { container } = render(
      <StorefrontShell site={{ ...SITE, theme }}>
        <StorefrontHome site={{ ...SITE, theme }} inventory={INVENTORY} />
      </StorefrontShell>,
    );
    expect(container.querySelector('.wl-site')).toHaveAttribute('data-theme', theme.toLowerCase());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(SITE.headline);
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#wl-main',
    );
    expect(screen.getByText('✓ Verified dealership on Dealers-Drive')).toBeInTheDocument();
    expect(
      screen.getByText(/Website services and verified customer enquiries/),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/certified car|warranty|testimonials|5 stars/i);
    expect(screen.getByRole('link', { name: /2023 Honda City/ })).toHaveAttribute(
      'href',
      '/car/honda-city',
    );
    expect(screen.queryByRole('link', { name: /Reserved Honda City/ })).not.toBeInTheDocument();
  });
  it('supports keyboard navigation and responsive menu semantics', async () => {
    render(
      <StorefrontShell site={{ ...SITE, theme }}>
        <p>Inventory</p>
      </StorefrontShell>,
    );
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus();
    const menu = screen.getByText(/Menu/).closest('details');
    expect(menu).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText(/Menu/));
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();
  });
  it('displays real filtered pagination links and an actionable empty state', () => {
    const { rerender } = render(
      <StorefrontInventory
        inventory={{ ...INVENTORY, page: { page: 2, limit: 24, total: 60, totalPages: 3 } }}
        query={{ q: 'Honda', fuel: 'petrol' }}
      />,
    );
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('Honda');
    expect(screen.getByLabelText('Fuel')).toHaveValue('petrol');
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute(
      'href',
      '/cars?q=Honda&fuel=petrol&page=1',
    );
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
      'href',
      '/cars?q=Honda&fuel=petrol&page=3',
    );
    rerender(
      <StorefrontInventory
        inventory={{
          ...INVENTORY,
          data: [],
          page: { page: 1, limit: 24, total: 0, totalPages: 1 },
        }}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'No cars match these filters' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute('href', '/cars');
  });
  it('uses the same vehicle data and blocks unavailable enquiry controls', () => {
    const { rerender } = render(
      <StorefrontVehicle site={{ ...SITE, theme }} car={CAR} related={INVENTORY} />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(CAR.title);
    expect(screen.getByRole('link', { name: 'Enquire about this car' })).toHaveAttribute(
      'href',
      '/enquire/honda-city',
    );
    expect(screen.getByText('Synthetic test vehicle description.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /2023 Honda City/ })).not.toBeInTheDocument();
    rerender(
      <StorefrontVehicle
        site={{ ...SITE, theme }}
        car={{ ...CAR, availability: 'RESERVED' }}
        related={INVENTORY}
      />,
    );
    expect(screen.queryByRole('link', { name: 'Enquire about this car' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Call dealership' })).not.toBeInTheDocument();
  });
  it('supports accessible gallery selection and a native fullscreen dialog', async () => {
    render(
      <StorefrontVehicle
        site={{ ...SITE, theme }}
        car={CAR}
        related={{ ...INVENTORY, data: [] }}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Show photograph 2' }));
    expect(screen.getByRole('button', { name: 'Show photograph 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const dialog = screen.getByLabelText(`${CAR.title} photographs`);
    const show = vi.fn(() => dialog.setAttribute('open', ''));
    const close = vi.fn(() => dialog.removeAttribute('open'));
    Object.defineProperty(dialog, 'showModal', { configurable: true, value: show });
    Object.defineProperty(dialog, 'close', { configurable: true, value: close });
    await user.click(screen.getByRole('button', { name: 'View vehicle photograph fullscreen' }));
    expect(show).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close ✕' }));
    expect(close).toHaveBeenCalledOnce();
  });
  it('handles missing photography and contact details without fake trust claims', () => {
    const site = {
      ...SITE,
      theme,
      contactPhone: null,
      whatsappPhone: null,
      mapsUrl: null,
      heroUrl: null,
      logoUrl: null,
      yardUrls: [],
      isVerified: false,
    };
    const { rerender } = render(<StorefrontContact site={site} />);
    expect(screen.queryByRole('link', { name: 'Call the dealership' })).not.toBeInTheDocument();
    expect(screen.getByText(/Contact details are being updated/)).toBeInTheDocument();
    rerender(<StorefrontAbout site={site} />);
    expect(screen.queryByText(/Verified dealership/)).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Alpha Motors dealership' })).toBeInTheDocument();
  });
  it('keeps draft preview read-only and displays empty inventory honestly', () => {
    const { container } = render(
      <StorefrontShell site={{ ...SITE, theme }} preview>
        <StorefrontHome
          site={{ ...SITE, theme }}
          inventory={{
            ...INVENTORY,
            data: [],
            page: { page: 1, limit: 24, total: 0, totalPages: 1 },
          }}
        />
      </StorefrontShell>,
    );
    expect(container.querySelector('.wl-site')).toHaveAttribute('inert');
    expect(screen.getByText(/Private preview/)).toBeInTheDocument();
    expect(screen.getByText('New arrivals are on their way')).toBeInTheDocument();
  });
});

describe('media and contrast boundaries', () => {
  it('recovers when an image failed before client hydration attached its error listener', () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    const width = vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
    try {
      render(<StorefrontImage src="/unavailable.webp" alt="Unavailable test photo" />);
      expect(screen.getByText('Photograph unavailable')).toBeInTheDocument();
    } finally {
      complete.mockRestore();
      width.mockRestore();
    }
  });
  it('provides authorized derivatives and a safe fallback after storage errors', () => {
    const url =
      'https://api.example.com/media/by-media/11111111-1111-4111-8111-111111111111/1600.webp';
    expect(responsiveImageSet(url)).toContain('/320.webp 320w');
    expect(responsiveImageSet('/unrelated.jpg')).toBeUndefined();
    const { rerender } = render(<StorefrontImage src={url} alt="Synthetic car" />);
    const image = screen.getByRole('img', { name: 'Synthetic car' });
    expect(image).toHaveAttribute('loading', 'lazy');
    fireEvent.error(image);
    expect(screen.getByText('Photograph unavailable')).toBeInTheDocument();
    rerender(<StorefrontImage src="/new.webp" alt="New car" priority />);
    expect(screen.getByRole('img', { name: 'New car' })).toHaveAttribute('loading', 'eager');
  });
  it('chooses AA-compatible foregrounds across the supported accent range', () => {
    const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    for (let red = 0; red <= 255; red += 17)
      for (let green = 0; green <= 255; green += 17)
        for (let blue = 0; blue <= 255; blue += 17) {
          const hex = `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
          const luminance =
            linear(red / 255) * 0.2126 + linear(green / 255) * 0.7152 + linear(blue / 255) * 0.0722;
          const contrast =
            accentForeground(hex) === '#ffffff'
              ? 1.05 / (luminance + 0.05)
              : (luminance + 0.05) / 0.05;
          expect(contrast).toBeGreaterThanOrEqual(4.5);
        }
  });
  it('does not render competitor dealer attribution from card DTOs', () => {
    render(
      <StorefrontHome
        site={SITE}
        inventory={{
          ...INVENTORY,
          data: [{ ...CARD, dealer: { ...CARD.dealer, name: 'Competitor dealer' } }],
        }}
      />,
    );
    expect(screen.queryByText('Competitor dealer')).not.toBeInTheDocument();
  });
});

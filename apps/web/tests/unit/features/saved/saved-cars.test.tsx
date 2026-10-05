import type { SavedVehiclesResponse, VehicleCardDto } from '@dealers-drive/contracts';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SavedCarsPage from '@/app/(public)/saved/page';
import { SaveButton } from '@/components/vehicle/save-button';
import { announceAuthHint } from '@/lib/use-auth-hint';
import { VehicleCard } from '@/components/vehicle/vehicle-card';
import {
  SavedVehiclesProvider,
  saveIntentPath,
  saveLoginHref,
  withoutSaveParam,
  type SavedSetter,
  type SavedSlugsLoader,
} from '@/features/saved';
import type * as ApiModule from '@/lib/api';

import { navigationState, setLocation } from '../../../setup.js';

/**
 * R75 — the heart on every card and on the vehicle page, the sign-in intent
 * that completes a save after login, and the Saved cars page.
 */
const apiGetParsed = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown };
});

function card(slug: string, overrides: Partial<VehicleCardDto> = {}): VehicleCardDto {
  return {
    slug,
    availability: 'AVAILABLE',
    title: `2022 Hyundai Creta ${slug}`,
    year: 2022,
    priceLabel: '₹12,00,000',
    metaLabel: '30,000 km · Petrol · Manual · Vellore',
    image: null,
    imageCount: 0,
    dealer: { name: 'Sri Lakshmi Motors', slug: 'sri', initials: 'SL', isVerified: true },
    ...overrides,
  };
}

function customer(slugs: string[] = []): SavedSlugsLoader {
  return vi.fn(() => Promise.resolve({ status: 'customer' as const, slugs }));
}

const anonymous: SavedSlugsLoader = () => Promise.resolve({ status: 'anonymous' });

function saving(result: Awaited<ReturnType<SavedSetter>> | 'echo' = 'echo') {
  return vi.fn<SavedSetter>((_slug, saved) =>
    Promise.resolve(result === 'echo' ? { status: 'ok' as const, saved } : result),
  );
}

async function withProvider(
  node: React.ReactNode,
  loadSlugs: SavedSlugsLoader,
  setSaved: SavedSetter = saving(),
) {
  render(
    <SavedVehiclesProvider loadSlugs={loadSlugs} setSaved={setSaved}>
      {node}
    </SavedVehiclesProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
}

afterEach(() => {
  apiGetParsed.mockReset();
  document.cookie = 'dd_auth=; Path=/; Max-Age=0';
});

describe('the heart', () => {
  it('asks nothing when this browser was last seen signed out', async () => {
    document.cookie = 'dd_auth=0; Path=/';
    const loadSlugs = customer(['a']);
    await withProvider(<VehicleCard vehicle={card('a')} />, loadSlugs);

    expect(loadSlugs).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save 2022 Hyundai Creta a' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('forgets every saved heart the moment the account signs out', async () => {
    await withProvider(<VehicleCard vehicle={card('a')} />, customer(['a']));
    expect(screen.getByRole('button', { name: /Remove 2022 Hyundai Creta a/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    act(() => {
      document.cookie = 'dd_auth=0; Path=/';
      announceAuthHint();
    });

    expect(screen.getByRole('button', { name: 'Save 2022 Hyundai Creta a' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('is absent without the provider, so a card outside the public pages has none', () => {
    render(<VehicleCard vehicle={card('a')} />);
    expect(screen.queryByRole('button', { name: /Save/ })).not.toBeInTheDocument();
  });

  it('shows what is saved, with labels a screen reader can use', async () => {
    await withProvider(
      <>
        <VehicleCard vehicle={card('a')} />
        <VehicleCard vehicle={card('b')} />
      </>,
      customer(['b']),
    );

    const unsaved = screen.getByRole('button', { name: 'Save 2022 Hyundai Creta a' });
    expect(unsaved).toHaveAttribute('aria-pressed', 'false');
    expect(unsaved).toHaveAttribute('title', 'Save vehicle');
    const saved = screen.getByRole('button', {
      name: 'Remove 2022 Hyundai Creta b from saved vehicles',
    });
    expect(saved).toHaveAttribute('aria-pressed', 'true');
    expect(saved).toHaveAttribute('title', 'Remove from saved vehicles');
  });

  it('saves at once, then asks the server, and does not open the car', async () => {
    const setSaved = saving();
    await withProvider(<VehicleCard vehicle={card('a')} />, customer(), setSaved);

    fireEvent.click(screen.getByRole('button', { name: 'Save 2022 Hyundai Creta a' }));
    expect(screen.getByRole('button', { name: /Remove 2022 Hyundai Creta a/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await waitFor(() => expect(setSaved).toHaveBeenCalledWith('a', true));
    expect(navigationState.pushed).toEqual([]);
  });

  it('puts the heart back when the server refuses, and says why', async () => {
    const setSaved = saving({
      status: 'refused',
      message: 'This car is no longer on the marketplace.',
    });
    await withProvider(<VehicleCard vehicle={card('a')} />, customer(), setSaved);

    fireEvent.click(screen.getByRole('button', { name: 'Save 2022 Hyundai Creta a' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save 2022 Hyundai Creta a' })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    );
    expect(screen.getByRole('status')).toHaveTextContent('no longer on the marketplace');
  });

  it('removes a saved car', async () => {
    const setSaved = saving();
    await withProvider(<VehicleCard vehicle={card('a')} />, customer(['a']), setSaved);
    fireEvent.click(screen.getByRole('button', { name: /Remove 2022 Hyundai Creta a/ }));
    await waitFor(() => expect(setSaved).toHaveBeenCalledWith('a', false));
    expect(screen.getByRole('button', { name: 'Save 2022 Hyundai Creta a' })).toBeInTheDocument();
  });

  it('keeps every heart for the same car in step', async () => {
    await withProvider(
      <>
        <VehicleCard vehicle={card('a')} />
        <SaveButton slug="a" title="2022 Hyundai Creta a" variant="labelled" />
      </>,
      customer(),
    );
    const [first] = screen.getAllByRole('button', { name: 'Save 2022 Hyundai Creta a' });
    fireEvent.click(first!);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Remove 2022 Hyundai Creta a/ })).toHaveLength(
        2,
      ),
    );
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('can save a reserved car — it is still on show', async () => {
    await withProvider(
      <VehicleCard vehicle={card('r', { availability: 'RESERVED' })} />,
      customer(),
    );
    expect(screen.getByRole('button', { name: 'Save 2022 Hyundai Creta r' })).toBeEnabled();
  });
});

describe('saving while signed out', () => {
  it('sends the visitor to the customer login, coming back to save that car', async () => {
    setLocation('/cars', 'brand=hyundai');
    window.history.replaceState(null, '', '/cars?brand=hyundai');
    const setSaved = saving();
    await withProvider(<VehicleCard vehicle={card('a')} />, anonymous, setSaved);

    fireEvent.click(screen.getByRole('button', { name: 'Save 2022 Hyundai Creta a' }));

    expect(setSaved).not.toHaveBeenCalled();
    expect(navigationState.pushed).toEqual([
      `/login?returnTo=${encodeURIComponent('/cars?brand=hyundai&save=a')}`,
    ]);
  });

  it('completes the save on the way back, and takes the intent out of the URL', async () => {
    setLocation('/car/a', 'save=a');
    const setSaved = saving();
    await withProvider(
      <SaveButton slug="a" title="Car a" variant="labelled" />,
      customer(),
      setSaved,
    );

    await waitFor(() => expect(setSaved).toHaveBeenCalledWith('a', true));
    expect(navigationState.replaced).toEqual(['/car/a']);
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('does not save twice when the car was already saved', async () => {
    setLocation('/car/a', 'save=a');
    const setSaved = saving();
    await withProvider(<SaveButton slug="a" title="Car a" />, customer(['a']), setSaved);
    await waitFor(() => expect(navigationState.replaced).toEqual(['/car/a']));
    expect(setSaved).not.toHaveBeenCalled();
  });

  it('asks again if the session ended between the page loading and the tap', async () => {
    const setSaved = saving({ status: 'signed-out' });
    await withProvider(<VehicleCard vehicle={card('a')} />, customer(), setSaved);
    fireEvent.click(screen.getByRole('button', { name: 'Save 2022 Hyundai Creta a' }));
    await waitFor(() => expect(navigationState.pushed[0]).toMatch(/^\/login\?returnTo=/));
  });
});

describe('the intent URL helpers', () => {
  it('adds and removes the save parameter, keeping the rest', () => {
    expect(saveIntentPath('/cars', 'brand=hyundai', 'a')).toBe('/cars?brand=hyundai&save=a');
    expect(saveLoginHref('/car/a', '', 'a')).toBe(
      `/login?returnTo=${encodeURIComponent('/car/a?save=a')}`,
    );
    expect(withoutSaveParam('/cars', 'brand=hyundai&save=a')).toBe('/cars?brand=hyundai');
    expect(withoutSaveParam('/car/a', 'save=a')).toBe('/car/a');
  });
});

function savedResponse(
  data: VehicleCardDto[],
  nextCursor: string | null = null,
): SavedVehiclesResponse {
  return {
    data: data.map((vehicle) => ({ savedAt: '2026-09-20T10:00:00.000Z', vehicle })),
    page: { nextCursor, hasMore: nextCursor !== null },
  };
}

describe('/saved', () => {
  it('reads the customer’s list uncached', async () => {
    apiGetParsed.mockResolvedValue(savedResponse([]));
    render(await SavedCarsPage({ searchParams: Promise.resolve({}) }));
    expect(apiGetParsed).toHaveBeenCalledWith(expect.anything(), '/v1/saved-vehicles?limit=50', {
      revalidate: false,
    });
  });

  it('groups what is saved by what became of it, and never links a car off the marketplace', async () => {
    apiGetParsed.mockResolvedValue(
      savedResponse([
        card('open'),
        card('held', { availability: 'RESERVED' }),
        card('gone', { availability: 'SOLD' }),
        card('paused', { availability: 'UNAVAILABLE' }),
      ]),
    );
    render(await SavedCarsPage({ searchParams: Promise.resolve({}) }));

    const available = within(screen.getByRole('region', { name: /^Available/ }));
    expect(available.getByRole('link', { name: '2022 Hyundai Creta open' })).toHaveAttribute(
      'href',
      '/car/open',
    );
    const reserved = within(screen.getByRole('region', { name: /^Reserved/ }));
    expect(reserved.getAllByText('Reserved', { selector: 'span' }).length).toBeGreaterThan(0);
    expect(reserved.queryByRole('link')).not.toBeInTheDocument();

    const gone = within(screen.getByRole('region', { name: /^No longer available/ }));
    expect(gone.getAllByText('Sold', { selector: 'span' }).length).toBeGreaterThan(0);
    expect(gone.getAllByText('No longer available', { selector: 'span' }).length).toBeGreaterThan(
      0,
    );
    expect(gone.queryByRole('link')).not.toBeInTheDocument();
  });

  it('invites a first save when the list is empty', async () => {
    apiGetParsed.mockResolvedValue(savedResponse([]));
    render(await SavedCarsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText('No saved cars yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse cars' })).toHaveAttribute('href', '/cars');
  });

  it('offers the next page', async () => {
    apiGetParsed.mockResolvedValue(savedResponse([card('a')], 'abc'));
    render(await SavedCarsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole('link', { name: 'Show more' })).toHaveAttribute(
      'href',
      '/saved?cursor=abc',
    );
  });

  it('sends a signed-out visitor to log in and come back', async () => {
    const { ApiError } = await import('@/lib/api');
    apiGetParsed.mockRejectedValue(
      new ApiError({ type: 'x', title: 'Unauthorized', status: 401, code: 'UNAUTHENTICATED' }),
    );
    await expect(SavedCarsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      /NEXT_REDIRECT|login/,
    );
  });
});

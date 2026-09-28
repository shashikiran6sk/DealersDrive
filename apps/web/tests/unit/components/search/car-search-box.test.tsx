import type { CarSuggestion, CarSuggestResponse } from '@dealers-drive/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { navigationState } from '../../../setup';

import { CarSearchBox, suggestionParams } from '@/components/search/car-search-box';
import type { VehicleSearchParams } from '@/lib/vehicle-search';

/**
 * The marketplace's search box, with suggestions (**R54**) — the dealers'
 * typeahead (`components/ui/autocomplete`) pointed at `/api/search/vehicles`.
 *
 * The claims are about what a buyer can do: typing asks after a pause and
 * changes nothing on the page; a suggestion is chosen by arrow and Enter or by
 * a click, and writes canonical filters; Escape and a click away close it.
 * Real timers and a hand-rolled `fetch`, as in `dealer-search-box.test.tsx`.
 */
const BRAND: CarSuggestion = {
  kind: 'BRAND',
  label: 'Hyundai',
  metaLabel: 'Brand · 12 cars',
  brand: 'hyundai',
  model: null,
  variant: null,
  count: 12,
};

const MODEL: CarSuggestion = {
  kind: 'MODEL',
  label: 'Hyundai Creta',
  metaLabel: 'Model · 5 cars',
  brand: 'hyundai',
  model: 'creta',
  variant: null,
  count: 5,
};

const VARIANT: CarSuggestion = {
  kind: 'VARIANT',
  label: 'Hyundai Creta SX(O)',
  metaLabel: 'Variant · 2 cars',
  brand: 'hyundai',
  model: 'creta',
  variant: 'SX(O)',
  count: 2,
};

let calls: string[] = [];

function payload(search: string, data: CarSuggestion[] = [BRAND, MODEL, VARIANT]) {
  return {
    search,
    data,
    countLabel: `${String(data.length)} matches`,
  } satisfies CarSuggestResponse;
}

function ok(body: CarSuggestResponse): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as unknown as Response;
}

function respondWith(handler: (search: string) => Promise<Response> | Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();
      calls.push(url);
      const search = new URL(url, 'http://localhost').searchParams.get('search') ?? '';
      if (init?.signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
      return Promise.resolve(handler(search));
    }),
  );
}

function renderBox(params: VehicleSearchParams = {}, districtName?: string) {
  const view = render(
    <CarSearchBox params={params} basePath="/cars" {...(districtName ? { districtName } : {})} />,
  );
  return { view, input: screen.getByRole('combobox') };
}

function options(): HTMLElement[] {
  return screen.queryAllByRole('option');
}

beforeEach(() => {
  calls = [];
  respondWith((search) => ok(payload(search)));
});

afterEach(() => vi.unstubAllGlobals());

describe('asking for suggestions', () => {
  it('asks once, after the typing pauses, through the BFF', async () => {
    const user = userEvent.setup();
    const { input } = renderBox();
    await user.type(input, 'creta');
    await waitFor(() => expect(options()).toHaveLength(3));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/^\/api\/search\/vehicles\?search=creta$/);
  });

  it('keeps to the page’s district, towns and dealers', async () => {
    const user = userEvent.setup();
    const { input } = renderBox({ district: 'ranipet', city: 'arcot', dealer: 'a-motors' });
    await user.type(input, 'c');
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toContain('district=ranipet');
    expect(calls[0]).toContain('city=arcot');
    expect(calls[0]).toContain('dealer=a-motors');
  });

  it('changes nothing on the page while a buyer is only typing', async () => {
    const user = userEvent.setup();
    const { input } = renderBox({ district: 'ranipet' });
    await user.type(input, 'creta');
    await waitFor(() => expect(options()).toHaveLength(3));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(navigationState.pushed).toEqual([]);
    expect(navigationState.replaced).toEqual([]);
  });

  it('says so while it is asking, and when nothing matches', async () => {
    let answer: (response: Response) => void = () => undefined;
    respondWith(() => new Promise<Response>((resolve) => (answer = resolve)));
    const user = userEvent.setup();
    const { input } = renderBox();
    await user.type(input, 'zz');
    await waitFor(() => expect(screen.getByText('Searching…')).toBeInTheDocument());
    answer(ok(payload('zz', [])));
    await waitFor(() => expect(screen.getByText('No matching cars for “zz”.')).toBeInTheDocument());
  });

  it('drops an answer to a search that has since been replaced', async () => {
    const pending: Record<string, (response: Response) => void> = {};
    respondWith((search) => new Promise<Response>((resolve) => (pending[search] = resolve)));
    const user = userEvent.setup();
    const { input } = renderBox();

    await user.type(input, 'cr');
    await waitFor(() => expect(calls).toHaveLength(1));
    await user.type(input, 'eta');
    await waitFor(() => expect(calls).toHaveLength(2));

    pending.creta?.(ok(payload('creta', [MODEL])));
    await waitFor(() => expect(options()).toHaveLength(1));
    pending.cr?.(ok(payload('cr', [BRAND, MODEL, VARIANT])));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(options()).toHaveLength(1);
  });
});

describe('the suggestions', () => {
  it('shows each row with what it is and how many cars, marking the typed characters', async () => {
    const user = userEvent.setup();
    const { input } = renderBox({ district: 'ranipet' }, 'Ranipet');
    await user.type(input, 'cre');
    await waitFor(() => expect(options()).toHaveLength(3));
    expect(options()[1]).toHaveTextContent('Hyundai Creta');
    expect(options()[1]).toHaveTextContent('Model · 5 cars');
    expect(within(options()[1] as HTMLElement).getByText('Cre').tagName).toBe('MARK');
    expect(screen.getByText('Cars in Ranipet district')).toBeInTheDocument();
    expect(screen.getByText('3 matches')).toBeInTheDocument();
  });

  it('moves with the arrows, wrapping, and takes the highlighted row on Enter', async () => {
    const user = userEvent.setup();
    const { input } = renderBox({ district: 'ranipet', fuel: 'petrol', page: '2' });
    await user.type(input, 'cre');
    await waitFor(() => expect(options()).toHaveLength(3));
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowUp}');
    expect(options()[2]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(options()[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options()[1]?.id);

    await user.keyboard('{Enter}');
    expect(navigationState.pushed).toEqual([
      '/cars?district=ranipet&brand=hyundai&model=creta&fuel=petrol',
    ]);
    expect(options()).toHaveLength(0);
    expect(input).toHaveValue('');
  });

  it('takes a clicked row, and a variant writes its model and the variant as the search', async () => {
    const user = userEvent.setup();
    const { input } = renderBox();
    await user.type(input, 'sx');
    await waitFor(() => expect(options()).toHaveLength(3));
    await user.click(options()[2] as HTMLElement);
    expect(navigationState.pushed).toEqual(['/cars?q=SX%28O%29&brand=hyundai&model=creta']);
    expect(input).toHaveValue('SX(O)');
  });

  it('closes on Escape and on a click away, writing nothing', async () => {
    const user = userEvent.setup();
    const { input } = renderBox();
    await user.type(input, 'cre');
    await waitFor(() => expect(options()).toHaveLength(3));
    await user.keyboard('{Escape}');
    expect(options()).toHaveLength(0);
    expect(input).toHaveValue('cre');

    await user.keyboard('{ArrowDown}');
    expect(options()).toHaveLength(3);
    await user.click(document.body);
    expect(options()).toHaveLength(0);
    expect(navigationState.pushed).toEqual([]);
  });
});

describe('free text and clearing', () => {
  it('searches the typed words on Enter when there is nothing to choose', async () => {
    respondWith((search) => ok(payload(search, [])));
    const user = userEvent.setup();
    const { input } = renderBox({ district: 'ranipet' });
    await user.type(input, 'white  suv');
    await waitFor(() => expect(screen.getByText(/No matching cars/)).toBeInTheDocument());
    await user.keyboard('{Enter}');
    expect(navigationState.pushed).toEqual(['/cars?district=ranipet&q=white+suv']);
  });

  it('clears the box and the search with ×, and only navigates when there was one', async () => {
    const user = userEvent.setup();
    renderBox({ q: 'creta', fuel: 'cng' });
    await user.click(screen.getByRole('button', { name: 'Clear the search' }));
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(navigationState.pushed).toEqual(['/cars?fuel=cng']);
  });

  it('follows the URL when the search is removed elsewhere, without opening', async () => {
    const { view, input } = renderBox({ q: 'creta' });
    expect(input).toHaveValue('creta');
    view.rerender(<CarSearchBox params={{}} basePath="/cars" />);
    await waitFor(() => expect(input).toHaveValue(''));
    expect(options()).toHaveLength(0);
    expect(calls).toEqual([]);
  });
});

describe('suggestionParams', () => {
  it('replaces the brand and model, drops the page, and keeps every other filter', () => {
    const params = { district: 'ranipet', brand: 'kia,tata', model: 'nexon', q: 'x', page: '4' };
    expect(suggestionParams(params, BRAND)).toEqual({ district: 'ranipet', brand: 'hyundai' });
    expect(suggestionParams({ fuel: 'cng' }, MODEL)).toEqual({
      fuel: 'cng',
      brand: 'hyundai',
      model: 'creta',
    });
    expect(suggestionParams({}, VARIANT)).toEqual({
      brand: 'hyundai',
      model: 'creta',
      q: 'SX(O)',
    });
  });
});

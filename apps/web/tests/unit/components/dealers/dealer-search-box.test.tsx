import type { DealerSuggestion, DealerSuggestResponse } from '@dealers-drive/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DealerSearchBox } from '@/components/dealers/dealer-search-box';

/**
 * The directory's search box, with recommendations (**R43**) — and through it,
 * the generic typeahead in `components/ui/autocomplete.tsx`.
 *
 * Tested here rather than against the hook in isolation because every claim
 * below is about what a buyer can *do*: press a key, see a row, get a search.
 * A hook test would assert the same state transitions one layer away from the
 * thing that has to be right.
 *
 * The flow the whole revision exists to deliver, in one line:
 *
 *   type → debounce 300 ms → one request → rows → first highlighted →
 *   ↑/↓ moves → Enter takes the highlighted one → click takes a different one
 *
 * ## Why real timers and an explicit gate on the fetch
 *
 * `userEvent` advances real time between keystrokes, and fake timers stop it —
 * the two do not mix without `advanceTimers`, which then makes assertions about
 * *not* having fetched meaningless. So the debounce is asserted with real
 * waiting (`waitFor`, which polls) and the request is resolved by hand, which
 * is also what makes the out-of-order test possible.
 */

const VELLORE_CARS: DealerSuggestion = {
  slug: 'vellore-cars',
  brandName: 'Vellore Cars',
  initials: 'VC',
  metaLabel: '42 cars in yard · Katpadi, Vellore',
  matchedOn: 'brandName',
  carCount: 42,
  isVerified: true,
};

const STAR_AUTO: DealerSuggestion = {
  slug: 'vellore-star-auto',
  brandName: 'Vellore Star Auto Yards',
  initials: 'VS',
  metaLabel: '18 cars in yard · Gandhi Nagar, Vellore',
  matchedOn: 'brandName',
  carCount: 18,
  isVerified: true,
};

const HONEST_WHEELS: DealerSuggestion = {
  slug: 'honest-wheels',
  brandName: 'Honest Wheels Vellore',
  initials: 'HW',
  metaLabel: '31 cars in yard · Bagayam, Vellore',
  matchedOn: 'brandName',
  carCount: 31,
  isVerified: true,
};

function payload(search: string, data = [VELLORE_CARS, STAR_AUTO, HONEST_WHEELS]) {
  return {
    search,
    data,
    countLabel: `${String(data.length)} matching yards`,
  } satisfies DealerSuggestResponse;
}

/** The URLs `fetch` was called with, in order. */
let calls: string[] = [];

function respondWith(handler: (search: string, url: string) => Promise<Response> | Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();
      calls.push(url);
      const search = new URL(url, 'http://localhost').searchParams.get('search') ?? '';

      // Honour the abort signal the way a real fetch does, so the abort test is
      // testing the component rather than the stub.
      if (init?.signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
      return Promise.resolve(handler(search, url));
    }),
  );
}

function ok(body: DealerSuggestResponse): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function renderBox(props: Partial<Parameters<typeof DealerSearchBox>[0]> = {}) {
  const onSearch = vi.fn();
  render(<DealerSearchBox onSearch={onSearch} {...props} />);
  return { onSearch, input: screen.getByRole('combobox') };
}

/** The rows, in the order they are drawn. */
function options(): HTMLElement[] {
  return screen.queryAllByRole('option');
}

/** The one row Enter would take. */
function highlighted(): HTMLElement | undefined {
  return options().find((option) => option.getAttribute('aria-selected') === 'true');
}

beforeEach(() => {
  calls = [];
  respondWith((search) => ok(payload(search)));
});

afterEach(() => vi.unstubAllGlobals());

describe('asking the API', () => {
  it('asks after the first character', async () => {
    const user = userEvent.setup();
    const { input } = renderBox();

    await user.type(input, 'v');

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toContain('search=v');
  });

  it('asks once for a word typed in one go, not once per keystroke', async () => {
    const user = userEvent.setup();
    const { input } = renderBox();

    await user.type(input, 'vellore');
    await waitFor(() => expect(options()).toHaveLength(3));

    // Seven characters, one request. This is the debounce, and it is the whole
    // reason the box does not hammer the endpoint.
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('search=vellore');
  });

  it('does not ask at all for an empty box', async () => {
    const user = userEvent.setup();
    const { input } = renderBox();

    await user.type(input, 'v');
    await waitFor(() => expect(calls).toHaveLength(1));

    await user.clear(input);

    // Nothing further: a suggest request with nothing in it has no answer.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(calls).toHaveLength(1);
  });

  it('passes the page’s own district and towns through', async () => {
    const user = userEvent.setup();
    const { input } = renderBox({ district: 'vellore', city: ['katpadi', 'ambur'] });

    await user.type(input, 'v');

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toContain('district=vellore');
    // Sorted, like every other place the town list is encoded.
    expect(calls[0]).toContain('city=ambur%2Ckatpadi');
  });
});

describe('the recommendations', () => {
  it('shows the matching dealerships under the input', async () => {
    const user = userEvent.setup();
    const { input } = renderBox();

    await user.type(input, 'vel');

    await waitFor(() => expect(options()).toHaveLength(3));
    expect(options()[0]).toHaveTextContent('Vellore Cars');
    expect(options()[0]).toHaveTextContent('42 cars in yard');
    expect(screen.getByText('3 matching yards')).toBeInTheDocument();
  });

  /** The default that makes "type, pause, Enter" work without arrowing. */
  it('highlights the first recommendation', async () => {
    const user = userEvent.setup();
    const { input } = renderBox();

    await user.type(input, 'vel');

    await waitFor(() => expect(options()).toHaveLength(3));
    expect(highlighted()).toHaveTextContent('Vellore Cars');
  });

  it('marks the characters that were typed', async () => {
    const user = userEvent.setup();
    const { input } = renderBox();

    await user.type(input, 'vel');
    await waitFor(() => expect(options()).toHaveLength(3));

    // Case-insensitive, and every occurrence — including the one in the middle
    // of "Honest Wheels Vellore".
    const marks = options().map((option) => within(option).queryByText('Vel')?.tagName);
    expect(marks).toEqual(['MARK', 'MARK', 'MARK']);
  });

  it('marks the place on a row that matched on its place', async () => {
    respondWith((search) =>
      ok(
        payload(search, [
          {
            ...VELLORE_CARS,
            brandName: 'Anand Motors',
            metaLabel: '9 cars in yard · Katpadi, Vellore',
            matchedOn: 'city',
          },
        ]),
      ),
    );
    const user = userEvent.setup();
    const { input } = renderBox();

    await user.type(input, 'katpadi');
    await waitFor(() => expect(options()).toHaveLength(1));

    // The name carries none of the typed characters, so nothing in it is
    // marked; the meta line is what earned the row and is what is marked.
    const row = options()[0] as HTMLElement;
    expect(within(row).getByText('Katpadi').tagName).toBe('MARK');
  });

  it('says it is a combobox, and which row the reader is on', async () => {
    const user = userEvent.setup();
    const { input } = renderBox();

    await user.type(input, 'vel');
    await waitFor(() => expect(options()).toHaveLength(3));

    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', highlighted()?.id);
  });
});

describe('the keyboard', () => {
  it('moves the highlight down and up', async () => {
    const user = userEvent.setup();
    const { input } = renderBox();

    await user.type(input, 'vel');
    await waitFor(() => expect(options()).toHaveLength(3));

    await user.keyboard('{ArrowDown}');
    expect(highlighted()).toHaveTextContent('Vellore Star Auto Yards');

    await user.keyboard('{ArrowDown}');
    expect(highlighted()).toHaveTextContent('Honest Wheels Vellore');

    await user.keyboard('{ArrowUp}');
    expect(highlighted()).toHaveTextContent('Vellore Star Auto Yards');
  });

  it('wraps at both ends', async () => {
    const user = userEvent.setup();
    const { input } = renderBox();

    await user.type(input, 'vel');
    await waitFor(() => expect(options()).toHaveLength(3));

    await user.keyboard('{ArrowUp}');
    expect(highlighted()).toHaveTextContent('Honest Wheels Vellore');

    await user.keyboard('{ArrowDown}');
    expect(highlighted()).toHaveTextContent('Vellore Cars');
  });

  /**
   * The headline behaviour: Enter without having chosen anything uses whatever
   * is highlighted, which by default is the first row.
   */
  it('searches for the highlighted row on Enter, with nothing explicitly selected', async () => {
    const user = userEvent.setup();
    const { input, onSearch } = renderBox();

    await user.type(input, 'vel');
    await waitFor(() => expect(options()).toHaveLength(3));
    await user.keyboard('{Enter}');

    expect(onSearch).toHaveBeenCalledWith('Vellore Cars');
    expect(input).toHaveValue('Vellore Cars');
    expect(options()).toHaveLength(0);
  });

  it('searches for whatever the arrows left highlighted', async () => {
    const user = userEvent.setup();
    const { input, onSearch } = renderBox();

    await user.type(input, 'vel');
    await waitFor(() => expect(options()).toHaveLength(3));
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onSearch).toHaveBeenCalledWith('Honest Wheels Vellore');
  });

  it('closes on Escape and keeps what was typed', async () => {
    const user = userEvent.setup();
    const { input, onSearch } = renderBox();

    await user.type(input, 'vel');
    await waitFor(() => expect(options()).toHaveLength(3));
    await user.keyboard('{Escape}');

    expect(options()).toHaveLength(0);
    // Escape is "stop showing me this", not "undo what I wrote".
    expect(input).toHaveValue('vel');
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('does nothing on Enter when nothing matched', async () => {
    respondWith((search) => ok({ search, data: [], countLabel: '0 matching yards' }));
    const user = userEvent.setup();
    const { input, onSearch } = renderBox();

    await user.type(input, 'zzzz');
    await waitFor(() => expect(screen.getByText(/No dealership matches/)).toBeInTheDocument());
    await user.keyboard('{Enter}');

    expect(onSearch).not.toHaveBeenCalled();
  });
});

describe('the pointer', () => {
  it('searches for a clicked recommendation', async () => {
    const user = userEvent.setup();
    const { input, onSearch } = renderBox();

    await user.type(input, 'vel');
    await waitFor(() => expect(options()).toHaveLength(3));
    // By the row, not by its text: the marked characters split the name across
    // a `<mark>`, which is exactly what the highlighter is supposed to do.
    await user.click(options()[1] as HTMLElement);

    expect(onSearch).toHaveBeenCalledWith('Vellore Star Auto Yards');
    expect(input).toHaveValue('Vellore Star Auto Yards');
  });

  it('follows the cursor with the highlight', async () => {
    const user = userEvent.setup();
    const { input } = renderBox();

    await user.type(input, 'vel');
    await waitFor(() => expect(options()).toHaveLength(3));
    await user.hover(options()[2] as HTMLElement);

    expect(highlighted()).toHaveTextContent('Honest Wheels Vellore');
  });

  it('clears the search when the box is emptied by the ✕', async () => {
    const user = userEvent.setup();
    const { input, onSearch } = renderBox({ q: 'Vellore Cars' });

    await user.click(screen.getByRole('button', { name: 'Clear the search' }));

    expect(onSearch).toHaveBeenCalledWith(null);
    expect(input).toHaveValue('');
  });

  it('does not re-ask for a dealership that was just chosen', async () => {
    const user = userEvent.setup();
    const { input } = renderBox();

    await user.type(input, 'vel');
    await waitFor(() => expect(options()).toHaveLength(3));
    await user.keyboard('{Enter}');

    // Choosing writes the name into the input, which is a change to the value —
    // and must not debounce into a request for the row just chosen.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(calls).toHaveLength(1);
    expect(options()).toHaveLength(0);
  });
});

describe('what goes wrong', () => {
  it('says so while it is still asking', async () => {
    let release: (() => void) | undefined;
    respondWith(
      (search) =>
        new Promise<Response>((resolve) => {
          release = () => resolve(ok(payload(search)));
        }),
    );
    const user = userEvent.setup();
    const { input } = renderBox();

    await user.type(input, 'vel');

    // Not "no dealerships match" — the most common way a typeahead lies.
    await waitFor(() => expect(screen.getByText('Searching…')).toBeInTheDocument());
    expect(options()).toHaveLength(0);

    release?.();
    await waitFor(() => expect(options()).toHaveLength(3));
  });

  it('says nothing matched, naming what was searched for', async () => {
    respondWith((search) => ok({ search, data: [], countLabel: '0 matching yards' }));
    const user = userEvent.setup();
    const { input } = renderBox();

    await user.type(input, 'zzzz');

    await waitFor(() =>
      expect(screen.getByText('No dealership matches “zzzz”.')).toBeInTheDocument(),
    );
  });

  it('degrades to a message when the endpoint fails', async () => {
    respondWith(() => ({ ok: false, status: 502 }) as Response);
    const user = userEvent.setup();
    const { input } = renderBox();

    await user.type(input, 'vel');

    await waitFor(() =>
      expect(screen.getByText(/Suggestions are unavailable just now/)).toBeInTheDocument(),
    );
  });

  /**
   * The failure abort cannot cover. A short query against a cold cache can
   * resolve *after* the longer one that replaced it, and rendering it would put
   * answers to "vel" under a box reading "vellore".
   */
  it('drops an answer that arrives after the query it answered was replaced', async () => {
    const pending = new Map<string, (value: Response) => void>();
    respondWith((search) => new Promise<Response>((resolve) => pending.set(search, resolve)));

    const user = userEvent.setup();
    const { input } = renderBox();

    await user.type(input, 'vel');
    await waitFor(() => expect(pending.has('vel')).toBe(true));

    await user.type(input, 'lore');
    await waitFor(() => expect(pending.has('vellore')).toBe(true));

    // The stale one lands first, and with a row that would be unmistakable.
    pending.get('vel')?.(ok(payload('vel', [{ ...VELLORE_CARS, brandName: 'Stale Motors' }])));
    pending.get('vellore')?.(ok(payload('vellore', [VELLORE_CARS])));

    await waitFor(() => expect(options()).toHaveLength(1));
    expect(screen.queryByText('Stale Motors')).not.toBeInTheDocument();
    expect(options()[0]).toHaveTextContent('Vellore Cars');
  });

  it('does not report an abort as a failure', async () => {
    respondWith((search) => new Promise<Response>(() => void search));
    const user = userEvent.setup();
    const { input } = renderBox();

    await user.type(input, 'v');
    await waitFor(() => expect(calls).toHaveLength(1));
    await user.type(input, 'e');

    // Typing another character cancels the request in flight; that is the
    // component cancelling itself, not an error a buyer should be told about.
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(screen.queryByText(/unavailable/)).not.toBeInTheDocument();
  });
});

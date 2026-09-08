import type { PublicLocations } from '@dealers-drive/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { navigationState, setLocation } from '../../../setup';

import { LocationSelector } from '@/components/layout/location-selector';

/**
 * The header's location button, and the dialog it opens (**R22**).
 *
 * It lists **districts**, not cities. A district is the area somebody would
 * drive across, the towns inside it give no hint they are related, and a
 * dropdown of every town on the platform stops being readable at about thirty.
 * The towns are the directory's chips, narrowed to whatever is chosen here.
 *
 * ## What these assert, and what they deliberately do not
 *
 * The claim R22 makes is a **hierarchy**: a state is a heading nothing can
 * select, a district is a button, and no district is ever shown without the
 * state it belongs to being visible. Every test below is about one of those
 * three sentences, plus the URL the choice writes — which is the only thing
 * about this component that anything else in the product depends on.
 *
 * Nothing here asserts a colour, a width or a breakpoint. The focus trap, the
 * scroll lock and the return of focus to the trigger are Radix's and are
 * covered by `dialog.test.tsx` at the primitive rather than re-tested through
 * every screen that opens one.
 */
const LOCATIONS: PublicLocations = {
  districts: [
    { slug: 'vellore', name: 'Vellore', count: 11, state: 'Tamil Nadu' },
    { slug: 'ranipet', name: 'Ranipet', count: 11, state: 'Tamil Nadu' },
    { slug: 'tirupattur', name: 'Tirupattur', count: 8, state: 'Tamil Nadu' },
    { slug: 'mysuru', name: 'Mysuru', count: 5, state: 'Karnataka' },
    { slug: 'bengaluru-urban', name: 'Bengaluru Urban', count: 4, state: 'Karnataka' },
  ],
  total: 44,
};

/** Opens the dialog and hands back the trigger, which most tests then assert on. */
async function open(user: ReturnType<typeof userEvent.setup>, label: RegExp): Promise<HTMLElement> {
  const trigger = screen.getByRole('button', { name: label });
  await user.click(trigger);
  return trigger;
}

/**
 * The district buttons currently on screen. `aria-pressed` is what makes one a
 * district rather than a filter chip or the close button, so that is what
 * selects them — the same attribute a screen reader uses to tell them apart.
 */
function districtOptions(): HTMLElement[] {
  return screen
    .getAllByRole('button')
    .filter((button) => button.getAttribute('aria-pressed') !== null);
}

describe('the trigger', () => {
  it('reads "All districts" until one is chosen, and the district after', () => {
    setLocation('/dealers');
    const { unmount } = render(<LocationSelector locations={LOCATIONS} />);
    expect(screen.getByRole('button', { name: /all districts/i })).toBeInTheDocument();
    unmount();

    setLocation('/dealers', 'district=ranipet');
    render(<LocationSelector locations={LOCATIONS} />);
    expect(screen.getByRole('button', { name: /ranipet/i })).toBeInTheDocument();
  });

  /** It opens a dialog now, and says so — a screen reader is told which. */
  it('announces a dialog rather than a menu', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);

    const trigger = screen.getByRole('button', { name: /all districts/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on Escape and hands focus back', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);
    const trigger = await open(user, /all districts/i);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(navigationState.pushed).toEqual([]);
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('opens from the keyboard', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);

    screen.getByRole('button', { name: /all districts/i }).focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

/**
 * The hierarchy, which is the whole of R22.
 *
 * A buyer looking at `Vellore`, `Mysuru` and `Bengaluru Urban` in one flat
 * column has to already know which state each is in — and the buyer who would
 * ask the question is exactly the one who does not.
 */
describe('states group the districts', () => {
  it('gives every state a heading, with the districts under it', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);
    await open(user, /all districts/i);

    const tn = screen.getByRole('heading', { name: /tamil nadu/i });
    const ka = screen.getByRole('heading', { name: /karnataka/i });

    const tnSection = tn.closest('section');
    const kaSection = ka.closest('section');

    expect(
      within(tnSection as HTMLElement)
        .getAllByRole('button')
        .map((button) => button.textContent?.split('\n')[0]),
    ).toEqual(['Vellore11 dealerships', 'Ranipet11 dealerships', 'Tirupattur8 dealerships']);

    expect(
      within(kaSection as HTMLElement)
        .getAllByRole('button')
        .map((button) => button.textContent?.split('\n')[0]),
    ).toEqual(['Mysuru5 dealerships', 'Bengaluru Urban4 dealerships']);
  });

  /**
   * The one rule this section has. A state is not a place the product can be
   * filtered to, so anything that looked pressable would be an invitation to a
   * dead end — and a heading that was a button would also put every state in
   * the tab order between the districts.
   */
  it('makes a state a heading and never a control', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);
    await open(user, /all districts/i);

    const heading = screen.getByRole('heading', { name: /tamil nadu/i });
    expect(heading.tagName).toBe('H3');
    expect(heading.closest('button')).toBeNull();
    expect(screen.queryByRole('button', { name: /^tamil nadu$/i })).toBeNull();
  });

  /** The busiest state leads, so two of the same size cannot swap between renders. */
  it('orders states by the dealerships in them', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);
    await open(user, /all districts/i);

    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Tamil Nadu',
      'Karnataka',
    ]);
  });

  /**
   * A district whose dealerships never filled the state in is still a place a
   * buyer can reach, so it is still offered — under a heading that says what is
   * missing rather than under a guess.
   */
  it('groups a district with no state under a heading that says so, last', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(
      <LocationSelector
        locations={{
          total: 20,
          districts: [
            { slug: 'nowhere', name: 'Nowhere', count: 9, state: null },
            { slug: 'vellore', name: 'Vellore', count: 2, state: 'Tamil Nadu' },
          ],
        }}
      />,
    );
    await open(user, /all districts/i);

    // Last despite being the bigger of the two: an absence does not lead.
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Tamil Nadu',
      'State not recorded',
    ]);
    expect(screen.getByRole('button', { name: /nowhere/i })).toBeInTheDocument();
  });
});

describe('choosing a district', () => {
  /**
   * `?district=ranipet&city=katpadi` is an empty page — Katpadi is in Vellore.
   * Rather than let a buyer navigate into that and wonder what they did,
   * changing the district drops the towns that belonged to the old one.
   */
  it('drops the towns and the page number when the district changes', async () => {
    setLocation('/dealers', 'district=vellore&city=katpadi,vellore&page=3&q=motors');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);

    await open(user, /vellore/i);
    await user.click(screen.getByRole('button', { name: /^ranipet/i }));

    // The name search survives: it is about the dealership, not the place.
    expect(navigationState.pushed).toEqual(['/dealers?district=ranipet&q=motors']);
  });

  /**
   * Choosing a place from the home page is a person saying where they are, and
   * the useful answer is the dealerships there — not the same home page with a
   * query string on it that nothing reads.
   */
  it('sends a visitor from anywhere else to the directory', async () => {
    setLocation('/');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);

    await open(user, /all districts/i);
    await user.click(screen.getByRole('button', { name: /^mysuru/i }));

    expect(navigationState.pushed).toEqual(['/dealers?district=mysuru']);
  });

  /** Immediate, as the dropdown was. R22 changed the shape, not the flow. */
  it('applies the choice and closes, with no confirmation step', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);

    await open(user, /all districts/i);
    expect(screen.queryByRole('button', { name: /confirm/i })).toBeNull();

    await user.click(screen.getByRole('button', { name: /^vellore/i }));

    expect(navigationState.pushed).toEqual(['/dealers?district=vellore']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('goes back to every district, and says how many that is', async () => {
    setLocation('/dealers', 'district=vellore');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);

    await open(user, /vellore/i);
    await user.click(screen.getByRole('button', { name: /all districts \(44\)/i }));

    expect(navigationState.pushed).toEqual(['/dealers']);
  });

  /** Nothing to go back from, so the way back is not offered as an action. */
  it('disables the way back when every district is already showing', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);
    await open(user, /all districts/i);

    expect(screen.getByRole('button', { name: /all districts \(44\)/i })).toBeDisabled();
  });

  /**
   * Status is never carried by colour alone (§4.15). The tick and
   * `aria-pressed` each say it on their own.
   */
  it('marks the chosen district as pressed, and ticks it', async () => {
    setLocation('/dealers', 'district=ranipet');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);
    await open(user, /ranipet/i);

    const chosen = screen.getByRole('button', { name: /^ranipet/i });
    expect(chosen).toHaveAttribute('aria-pressed', 'true');
    expect(chosen.textContent).toContain('✓');
    expect(screen.getByRole('button', { name: /^vellore/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  /**
   * Focus was inside a dialog that has just stopped existing. Left alone it
   * falls to `<body>` and the next Tab starts from the top of the document —
   * the same trap the dropdown's Esc handling avoided by hand, and the reason
   * the trigger is Radix's rather than this component's (see `Dialog`).
   */
  it('hands focus back to the button after choosing', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);
    const trigger = await open(user, /all districts/i);

    await user.click(screen.getByRole('button', { name: /^vellore/i }));

    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  /** And the footer names the pair, which is the point of the whole change. */
  it('names the chosen district with its state in the footer', async () => {
    setLocation('/dealers', 'district=mysuru');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);
    await open(user, /mysuru/i);

    expect(screen.getByText(/mysuru, karnataka/i)).toBeInTheDocument();
  });
});

/**
 * Search, and the rule that makes it worth having: a result never appears
 * without the state it is in. `Vellore` on its own is the ambiguity R22 exists
 * to remove, so a search that reintroduced it would undo the change.
 */
describe('search', () => {
  it('names the state on every result', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);
    await open(user, /all districts/i);

    await user.type(screen.getByLabelText(/search districts/i), 'ur');

    const results = screen.getAllByRole('button', { name: /tamil nadu|karnataka/i });
    expect(results.map((button) => button.textContent?.replace(/\s+/g, ' '))).toEqual([
      'TirupatturTamil Nadu · 8 dealerships',
      'MysuruKarnataka · 5 dealerships',
      'Bengaluru UrbanKarnataka · 4 dealerships',
    ]);
  });

  it('finds a district by the state it is in', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);
    await open(user, /all districts/i);

    await user.type(screen.getByLabelText(/search districts/i), 'karnataka');

    expect(screen.getByText(/2 matching districts/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^vellore/i })).toBeNull();
  });

  it('says so rather than showing an empty grid', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);
    await open(user, /all districts/i);

    await user.type(screen.getByLabelText(/search districts/i), 'zzz');

    expect(screen.getByText(/no matching districts/i)).toBeInTheDocument();
  });

  it('chooses from a result the same way it chooses from the grid', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);
    await open(user, /all districts/i);

    await user.type(screen.getByLabelText(/search districts/i), 'mysuru');
    await user.click(screen.getByRole('button', { name: /^mysuru/i }));

    expect(navigationState.pushed).toEqual(['/dealers?district=mysuru']);
  });
});

/**
 * The state row narrows what is on screen. It is navigation and nothing else —
 * a state is not a location this product can be filtered to, and a filter chip
 * that quietly became the buyer's location would be the exact bug the grouping
 * was built to avoid.
 */
describe('the state filter', () => {
  it('narrows the districts without navigating anywhere', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);
    await open(user, /all districts/i);

    await user.click(screen.getByRole('button', { name: /^karnataka 2$/i }));

    expect(screen.queryByRole('heading', { name: /tamil nadu/i })).toBeNull();
    expect(screen.getByRole('button', { name: /^mysuru/i })).toBeInTheDocument();
    expect(navigationState.pushed).toEqual([]);
  });

  it('goes back to every state', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(<LocationSelector locations={LOCATIONS} />);
    await open(user, /all districts/i);

    await user.click(screen.getByRole('button', { name: /^karnataka 2$/i }));
    await user.click(screen.getByRole('button', { name: /^all states$/i }));

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
  });

  /** One state to move between is not a choice; it is a control taking up room. */
  it('is absent when the platform trades in one state', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(
      <LocationSelector
        locations={{
          total: 22,
          districts: [{ slug: 'vellore', name: 'Vellore', count: 11, state: 'Tamil Nadu' }],
        }}
      />,
    );
    await open(user, /all districts/i);

    expect(screen.queryByRole('group', { name: /filter by state/i })).toBeNull();
  });
});

/**
 * The API is allowed to be unreachable — the layout degrades to an empty list
 * rather than letting a throw take the whole document to `global-error`. The
 * button still has to be a button, and the dialog still has to say something.
 */
describe('when there is nothing to offer', () => {
  it('opens and explains itself', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(<LocationSelector locations={{ districts: [], total: 0 }} />);

    await open(user, /all districts/i);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/no dealerships are listed yet/i)).toBeInTheDocument();
    expect(districtOptions()).toEqual([]);
  });
});

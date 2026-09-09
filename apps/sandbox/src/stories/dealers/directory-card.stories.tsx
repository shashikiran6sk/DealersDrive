import type { DealerCard } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { DirectoryCard } from '@/components/dealers/dealer-card';

/**
 * DESIGN-SPEC §3.5 — the directory card (C038).
 *
 * ⚠️ **The file is `dealer-card.tsx` and the export is `DirectoryCard`.** That
 * is finding **D-6**: nothing named `DealerCard` exists in the UI — `DealerCard`
 * is the *contracts DTO* this component takes. Somebody searching the registry
 * for either name has to land here rather than write a second card, which is
 * what the `aliases` field is for.
 *
 * ## R28 — the card as `docs/Dealers-Drive-UI/Dealer-Card` draws it
 *
 * The composition changed; the rules that hold it together did not. What is
 * new to look at:
 *
 *   · **The identity plate row straddles the cover's bottom edge.** A 48px
 *     white logo tile pulled up 24px on the left, the VERIFIED DEALER plate on
 *     the right, and the name starting underneath both rather than sharing a
 *     line with the plate.
 *   · **YARD VERIFIED sits on the cover**, top right, on an ink wash. There is
 *     no year on it — nothing on the platform records when a yard was audited,
 *     so the reference's "· 2024" is deliberately absent.
 *   · **The tagline is a pledge panel** — tinted, with an accent rule down its
 *     left edge and decorative quotation marks. The marks are `aria-hidden`;
 *     the sentence a screen reader gets is the dealer's own, unquoted.
 *   · **The third service chip takes the accent.** Keyed to the position, not
 *     to the value — `ManyServices` and a one-service card in `InTheGrid` are
 *     where that degrades or does not.
 *   · **The footer runs to the card's edges** on a tint, under a hairline,
 *     rather than sitting inside the body's padding.
 *
 * Deliberately *not* taken from the reference: the card does not lift or cast a
 * shadow on hover. §4.1 gives shadows to exactly three elements — the city
 * dropdown, the dialog and the mobile sheet — and a directory of eighteen
 * lifting cards is not the place to make it four. The border takes the accent
 * instead.
 *
 * Three things to check by eye:
 *
 *   · **The whole card is one link.** The heading's anchor is stretched over it
 *     with `after:absolute after:inset-0`, and "View inventory →" is lifted
 *     above that with `z-[2]` — it is an affordance pointing at the same
 *     destination, not a second one. A nested anchor would be invalid HTML and
 *     would give a screen reader two links to the same page.
 *   · **The logo tile does not move when the name wraps.** That was **R24**,
 *     and R28 retired the fix by retiring the cause: the tile is no longer in
 *     the heading's row at all, so its position is fixed against the cover.
 *     `ShortAndLongName` is still the story — the two tiles must start level.
 *   · **The card is one fixed size** (R21), and nothing on it changes that:
 *     not a missing tagline, not a third service, not a fifty-character name.
 *     `SameDataTwice` is the story that proves it — two directories, one
 *     sparse and one full, whose cards measure the same.
 *
 * Both branches are live. A dealership that has uploaded a yard photograph gets
 * `coverUrl` — the 640px rendition, addressed by media id — and one that has
 * not gets the `ImageSlot`, which names the shot rather than showing a grey
 * rectangle. `WithCover` and `Default` are the two, side by side. The cover's
 * gradient wash is on the photograph branch only: it is there so the white tile
 * has something to sit against on a bright forecourt, and the flat `ImageSlot`
 * needs no such help.
 */
const BASE: DealerCard = {
  slug: 'sri-lakshmi-motors',
  brandName: 'Sri Lakshmi Motors',
  initials: 'SL',
  city: 'Vellore',
  state: 'Tamil Nadu',
  yearsOperating: 17,
  yearsLabel: 'Vellore, Tamil Nadu · 17 years',
  tagline: 'Hatchbacks under ₹6 lakh, every one inspected in-house',
  services: ['Hatchbacks', 'RC transfer', 'Exchange'],
  carCount: 7,
  fromPricePaise: 22_500_00,
  fromPriceLabel: 'from ₹2.25 Lakh',
  isVerified: true,
  logoUrl: null,
  coverUrl: null,
};

const meta = {
  title: 'Dealers/DirectoryCard',
  component: DirectoryCard,
  parameters: { layout: 'centered', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      // The grid cell it lives in: `minmax(290px, 1fr)`.
      <div style={{ width: 300 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DirectoryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A dealership that has answered everything and is trading. */
export const Default: Story = { args: { dealer: BASE } };

/**
 * The state every dealership is in until **F064** puts a listing on the
 * platform: verified, findable, and holding nothing yet. A8 is explicit that it
 * still appears — dropping it would make the network look smaller than it is —
 * and the em dash is what stands in for a "from" price that does not exist.
 */
export const NoLiveCars: Story = {
  args: { dealer: { ...BASE, carCount: 0, fromPricePaise: null, fromPriceLabel: '—' } },
};

/** One car. The label is singular, which a `${n} cars listed` template gets wrong. */
export const OneCar: Story = {
  args: {
    dealer: { ...BASE, carCount: 1, fromPricePaise: 4_20_000, fromPriceLabel: 'from ₹4.2 Lakh' },
  },
};

/**
 * Nothing optional filled in — the hour after onboarding completes, and the
 * state that prompted **R17**. On its own it is the `min-h` floor that keeps
 * this card the ordinary size; in the directory it is `grid-auto-rows: 1fr`
 * that makes it match the cards beside it.
 */
export const Sparse: Story = {
  args: {
    dealer: {
      ...BASE,
      tagline: null,
      services: [],
      carCount: 0,
      fromPricePaise: null,
      fromPriceLabel: '—',
    },
  },
};

/**
 * No tagline, but services. The paragraph is not rendered at all — nothing
 * reserves a two-line box for it — and the card is still the ordinary height,
 * because `min-h` is the floor and `mt-auto` keeps the footer at the bottom of
 * whatever is left (R17).
 */
export const NoTagline: Story = { args: { dealer: { ...BASE, tagline: null } } };

/**
 * The 200-character tagline the contract allows. `line-clamp-2` cuts it at two
 * lines, which is what stops one talkative dealership from setting the height
 * of every card in the grid — see `InTheGrid`, where it is the third card.
 */
export const LongTagline: Story = {
  args: {
    dealer: {
      ...BASE,
      tagline:
        'Family-run since 1998 on Katpadi Main Road, buying directly from single-owner ' +
        'customers across the Vellore belt, every car through a 120-point check in our own ' +
        'workshop, with the full service history in hand.',
    },
  },
};

/**
 * Five services. The API slices to three and so does the component — belt and
 * braces, because a card with five chips wraps to a fourth row and breaks the
 * grid's rhythm. The portfolio is where the full list belongs.
 */
export const ManyServices: Story = {
  args: {
    dealer: {
      ...BASE,
      services: ['Hatchbacks', 'SUVs', 'Sedans', 'RC transfer', 'Finance'],
    },
  },
};

/**
 * **R28's most arguable line, made easy to argue with.** One service, two, and
 * three, side by side.
 *
 * The reference accents the third chip on every card it draws, and every card
 * it draws has three. The rule here is keyed to the *position* rather than to
 * the value, because nothing makes a dealership's third service more important
 * than its first — so the accent is a focal point at the end of a full row, and
 * a dealership with one or two services gets plain chips rather than a lone
 * highlighted one that looks like a claim.
 *
 * If that reads wrong on the page, this is the story that shows it, and the
 * alternative is a single line in `dealer-card.tsx`.
 */
export const ServiceChips: Story = {
  args: { dealer: BASE },
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    () => (
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(3, 300px)' }}>
        <DirectoryCard dealer={{ ...BASE, slug: 'one', services: ['Hatchbacks'] }} />
        <DirectoryCard dealer={{ ...BASE, slug: 'two', services: ['Hatchbacks', 'RC transfer'] }} />
        <DirectoryCard
          dealer={{
            ...BASE,
            slug: 'three',
            services: ['In-house workshop', 'RC transfer assistance', 'Bank loan tie-ups'],
          }}
        />
      </div>
    ),
  ],
};

/**
 * The long-name case. Indian dealership names run long — "Sri Venkateswara
 * Automobiles and Finance Private Limited" is not unusual — and the heading has
 * to wrap beside the VERIFIED plate without pushing it off the card.
 *
 * **This is the R24 story, and R28 is why it now passes trivially.** The thing
 * to check is the logo tile: its top edge must be exactly where it is in
 * `Default`, because it is positioned against the cover rather than against the
 * name. It used to slide down to the second line, when the tile shared a row
 * with the heading and was aligned to the bottom of it. `ShortAndLongName` puts
 * the two side by side so the tile is either level across both or is not.

 * With the plate out of the heading's row, the name also has the full width of
 * the card to wrap in — which is the other half of what this story shows.
 */
export const LongBrandName: Story = {
  args: {
    dealer: {
      ...BASE,
      brandName: 'Sri Venkateswara Automobiles and Finance Private Limited',
      initials: 'SV',
      yearsLabel: 'Tiruvannamalai, Tamil Nadu · 3 years',
    },
  },
};

/**
 * **R24, and the comparison the bug was reported as.** A one-word name and a
 * name that wraps, side by side, at the width the grid actually gives a card.
 *
 * The logo tiles must start at the same height. They did not: the left card's
 * tile sat beside "Chennai cars" and the right card's sat beside "CARS", the
 * second line of "GOWTHAM CARS" — a 21px drop that made a row of cards look
 * ragged for no reason a reader could see.
 *
 * Under **R28** the tiles are straddling the cover's bottom edge, which is a
 * fixed distance from the top of the card, so this is now a check that the
 * structure is still what it claims rather than a check on an alignment rule.
 */
export const ShortAndLongName: Story = {
  args: { dealer: BASE },
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    () => (
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '300px 300px' }}>
        <DirectoryCard
          dealer={{
            ...BASE,
            slug: 'chennai-cars',
            brandName: 'Chennai cars',
            initials: 'CC',
            yearsLabel: 'Vellore, Tamil Nadu · 1 year',
          }}
        />
        <DirectoryCard
          dealer={{
            ...BASE,
            slug: 'gowtham-cars',
            brandName: 'GOWTHAM CARS AND AUTOMOBILES',
            initials: 'GC',
            yearsLabel: 'Chittoor, Andhra Pradesh · 1 year',
          }}
        />
      </div>
    ),
  ],
};

/**
 * Unverified. Not a state the directory can currently produce — `listActive()`
 * returns ACTIVE dealerships only, and the service hard-codes `isVerified:
 * true` — but the flag is in the contract and the card branches on it, so the
 * branch is worth being able to see.
 */
export const Unverified: Story = { args: { dealer: { ...BASE, isVerified: false } } };

/**
 * A dealership that has uploaded one. The photograph is cropped into the 104px
 * band with `object-cover`, so the thing to check by eye is that the logo tile
 * still reads against it — the tile crosses the divider, and a busy photograph
 * is where that crossing either works or does not.
 */
export const WithCover: Story = {
  args: {
    dealer: {
      ...BASE,
      coverUrl:
        'data:image/svg+xml;utf8,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="104">' +
            '<rect width="300" height="104" fill="%231e3fae"/>' +
            '<text x="150" y="58" font-family="sans-serif" font-size="13" fill="white" text-anchor="middle">yard photograph</text>' +
            '</svg>',
        ),
    },
  },
};

/**
 * Six dealerships over two rows — the arrangement R17 needed, and the one R21
 * keeps honest.
 *
 * Cards in the *same* row have always matched each other; grid stretches them
 * to the row. What R17 added was matching *between* rows, and what it could not
 * give was a fixed size: every card took the height of the fullest card on the
 * page, so the third card's long tagline set the proportions for all six.
 *
 * The height is a constant now — 400px since **R28** re-measured it for the
 * taller cover and the pledge panel's padding. What to check by eye:
 *
 *   · **All six cards are the same height**, as before.
 *   · **The third card's long tagline is cut at two lines** and does not make
 *     the other five taller — compare against `SameDataTwice`, which measures
 *     it rather than asking you to.
 *   · **The three sparse cards leave the slack empty above a footer that is
 *     still on the bottom edge.** That empty space is the fixed size doing its
 *     job, not a card that failed to fill.
 */
export const InTheGrid: Story = {
  args: { dealer: BASE },
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    () => (
      <div
        style={{
          display: 'grid',
          gap: 18,
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
          // R17 — the half of the fix that is not in the card. Every implicit
          // row takes the height of the tallest card in the grid, so the sparse
          // second row matches the first.
          gridAutoRows: '1fr',
          // Fixed, because the meta decorator above sizes a single card at 300px.
          width: 960,
        }}
      >
        {GRID.map((dealer) => (
          <DirectoryCard key={dealer.slug} dealer={dealer} />
        ))}
      </div>
    ),
  ],
};

/**
 * The first row has everything to say, the second has almost nothing — which is
 * a real directory page, where onboarding-fresh dealerships sit beside ones that
 * have been trading for a decade.
 */
const GRID: DealerCard[] = [
  BASE,
  {
    ...BASE,
    slug: 'annamalai-auto-mart',
    brandName: 'Annamalai Auto Mart',
    initials: 'AA',
    tagline: 'Sedans and SUVs, finance arranged in-house, exchange welcome',
    services: ['Sedans', 'Finance', 'Exchange'],
    carCount: 12,
    fromPriceLabel: 'from ₹3.4 Lakh',
    yearsLabel: 'Ranipet, Tamil Nadu · 9 years',
  },
  {
    ...BASE,
    slug: 'sri-venkateswara',
    brandName: 'Sri Venkateswara Automobiles and Finance Private Limited',
    initials: 'SV',
    tagline:
      'Family-run since 1998 on Katpadi Main Road, buying directly from single-owner ' +
      'customers across the Vellore belt, every car through a 120-point check in our own ' +
      'workshop, with the full service history in hand.',
    carCount: 1,
    fromPriceLabel: 'from ₹4.2 Lakh',
    yearsLabel: 'Tiruvannamalai, Tamil Nadu · 3 years',
  },
  {
    ...BASE,
    slug: 'velavan-cars',
    brandName: 'Velavan Cars',
    initials: 'VC',
    tagline: null,
    services: ['SUVs'],
    carCount: 0,
    fromPricePaise: null,
    fromPriceLabel: '—',
    yearsLabel: 'Katpadi, Tamil Nadu · 4 years',
  },
  {
    ...BASE,
    slug: 'kumaran-motors',
    brandName: 'Kumaran Motors',
    initials: 'KM',
    tagline: null,
    services: [],
    carCount: 0,
    fromPricePaise: null,
    fromPriceLabel: '—',
    yearsLabel: 'Arakkonam, Tamil Nadu · 1 year',
  },
  {
    ...BASE,
    slug: 'gandhi-nagar-cars',
    brandName: 'Gandhi Nagar Cars',
    initials: 'GN',
    tagline: null,
    services: ['RC transfer'],
    carCount: 2,
    fromPriceLabel: 'from ₹5.1 Lakh',
    yearsLabel: 'Walajapet, Tamil Nadu · 2 years',
  },
];

/**
 * **The worst case, and the one `CARD_HEIGHT` is measured against.** A
 * registered name that wraps to two lines, a tagline that fills its two, and
 * three services long enough to wrap to a second row — all at once.
 *
 * Nothing here may be cut off. If a font change or a line-height rounding ever
 * makes it so, this is the story that shows it: the second row of tags is the
 * first thing to go, and it goes silently, because the box clips rather than
 * scrolling.
 */
export const Fullest: Story = {
  args: {
    dealer: {
      ...BASE,
      brandName: 'Sri Venkateswara Automobiles and Finance Private Limited',
      initials: 'SV',
      yearsLabel: 'Tiruvannamalai, Tamil Nadu · 3 years',
      tagline:
        'Family-run since 1998 on Katpadi Main Road, buying directly from single-owner ' +
        'customers across the whole of the Vellore belt, every car checked in our own workshop.',
      services: ['In-house workshop', 'RC transfer assistance', 'Bank loan tie-ups'],
    },
  },
};

/**
 * **R21, and the reason it exists.** The same three dealerships, twice: once
 * with almost nothing filled in, once with taglines and three services each.
 *
 * The reported bug is visible only in this comparison, and it is not visible in
 * either half alone — under R17 every card in the top grid was shorter than
 * every card in the bottom one, because "equal to each other" is not "fixed".
 * The two grids now measure the same, and the number is printed under each so
 * the check is a reading rather than a squint.
 */
export const SameDataTwice: Story = {
  args: { dealer: BASE },
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, width: 960 }}>
        <MeasuredGrid label="Nothing optional filled in" dealers={SPARSE_ROW} />
        <MeasuredGrid label="Taglines and three services each" dealers={FULL_ROW} />
      </div>
    ),
  ],
};

/** The three of them with nothing to say. */
const SPARSE_ROW: DealerCard[] = [
  {
    ...BASE,
    slug: 'arcot-cars',
    brandName: 'Arcot cars',
    initials: 'AC',
    tagline: null,
    services: [],
    carCount: 0,
    fromPricePaise: null,
    fromPriceLabel: '—',
    yearsLabel: 'Arcot, Tamil Nadu · 1 year',
  },
  {
    ...BASE,
    slug: 'chennai-cars',
    brandName: 'Chennai cars',
    initials: 'CC',
    tagline: null,
    services: [],
    carCount: 0,
    fromPricePaise: null,
    fromPriceLabel: '—',
    yearsLabel: 'Vellore, Tamil Nadu · 1 year',
  },
  {
    ...BASE,
    slug: 'sakthi-cars',
    brandName: 'Sakthi cars',
    initials: 'SC',
    tagline: null,
    services: [],
    carCount: 0,
    fromPricePaise: null,
    fromPriceLabel: '—',
    yearsLabel: 'Velachery, Tamilnadu · 1 year',
  },
];

/** The same three after they have filled their profiles in. */
const FULL_ROW: DealerCard[] = [
  {
    ...SPARSE_ROW[0]!,
    tagline: 'Hatchbacks under ₹6 lakh, every one inspected in-house before it is listed',
    services: ['In-house workshop', 'RC transfer assistance', 'Bank loan tie-ups'],
  },
  {
    ...SPARSE_ROW[1]!,
    tagline:
      'Family-run since 2014 — single-owner cars with full service history. Family-run since 2014.',
    services: ['In-house workshop', 'RC transfer assistance', 'Bank loan tie-ups'],
  },
  {
    ...SPARSE_ROW[2]!,
    tagline: 'Mass cars',
    services: ['insurance', 'return policy'],
  },
];

/**
 * A grid that reports its own card height, because "are these the same size?"
 * is a question a screenshot answers badly and a number answers exactly.
 */
function MeasuredGrid({ label, dealers }: { label: string; dealers: DealerCard[] }) {
  const [height, setHeight] = useState<number | null>(null);

  return (
    <div>
      <div style={{ fontSize: 12, marginBottom: 8, opacity: 0.7 }}>
        {label} — card height:{' '}
        <strong data-testid="card-height">{height === null ? '…' : `${String(height)}px`}</strong>
      </div>
      <div
        ref={(node) => {
          const card = node?.querySelector('article');
          if (card) setHeight(Math.round(card.getBoundingClientRect().height));
        }}
        style={{
          display: 'grid',
          gap: 18,
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
        }}
      >
        {dealers.map((dealer) => (
          <DirectoryCard key={dealer.slug} dealer={dealer} />
        ))}
      </div>
    </div>
  );
}

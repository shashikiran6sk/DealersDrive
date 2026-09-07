import type { DealerCard } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

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
 * Three things to check by eye:
 *
 *   · **The whole card is one link.** The heading's anchor is stretched over it
 *     with `after:absolute after:inset-0`, and "View inventory →" is lifted
 *     above that with `z-[2]` — it is an affordance pointing at the same
 *     destination, not a second one. A nested anchor would be invalid HTML and
 *     would give a screen reader two links to the same page.
 *   · **The logo tile crosses the divider.** It is pulled up 34px over the
 *     cover's bottom edge, which is what makes the cover read as a photograph
 *     of premises rather than as a banner.
 *   · **Every optional field is genuinely optional, and none of them changes
 *     the card's height** (R17). No tagline, no services, no cover, no live
 *     cars — each has a story below, because each is the normal state for a
 *     dealership that finished onboarding an hour ago.
 *
 * Both branches are live. A dealership that has uploaded a yard photograph gets
 * `coverUrl` — the 640px rendition, addressed by media id — and one that has
 * not gets the `ImageSlot`, which names the shot rather than showing a grey
 * rectangle. `WithCover` and `Default` are the two, side by side.
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
 * The long-name case. Indian dealership names run long — "Sri Venkateswara
 * Automobiles and Finance Private Limited" is not unusual — and the heading has
 * to wrap beside the VERIFIED plate without pushing it off the card.
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
 * Six dealerships over two rows, which is the only arrangement that shows what
 * **R17** fixed.
 *
 * Cards in the *same* row have always matched each other — grid stretches them
 * to the row. The damage was between rows: the second row here is three sparse
 * dealerships, and without `grid-auto-rows: 1fr` it came out visibly shorter
 * than the first, so the grid's rhythm broke at whatever point in the directory
 * the quiet dealerships happened to fall.
 *
 * Two things to check by eye:
 *
 *   · **Both rows are the same height**, and all six footers sit on one of two
 *     lines. That is `grid-auto-rows: 1fr` on the container.
 *   · **The long tagline is cut at two lines** (third card, first row). Without
 *     the clamp, one talkative dealership would set the height of all six —
 *     the same failure, arrived at from the other direction.
 *
 * The `min-h` floor on the card is the third case and is not visible here: it
 * is what a page where *every* dealership is sparse falls back to, which is
 * `Sparse` on its own.
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

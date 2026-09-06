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
 *   · **Every optional field is genuinely optional.** No tagline, no services,
 *     no cover, no live cars — each has a story below, because each is the
 *     normal state for a dealership that finished onboarding an hour ago.
 *
 * **Every card takes the no-cover branch today.** There is no permanent public
 * URL for the yard photograph until **F034**, so `coverUrl` is null for every
 * dealership the API returns; `WithCover` below is what F034 turns on.
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

/** Nothing optional filled in — the hour after onboarding completes. */
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

/** No tagline, but services. The paragraph disappears rather than reserving space. */
export const NoTagline: Story = { args: { dealer: { ...BASE, tagline: null } } };

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

/** What **F034** turns on: a real photograph of the yard instead of the slot. */
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
 * The grid the cards actually sit in, so the row rhythm is checkable — and the
 * thing to look at is the bottom row: `mt-auto` pins the count-and-price strip
 * to the foot of every card, so three cards with different amounts of prose
 * still line their footers up.
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
          // Fixed, because the meta decorator above sizes a single card at 300px.
          width: 960,
        }}
      >
        <DirectoryCard dealer={BASE} />
        <DirectoryCard
          dealer={{
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
          }}
        />
        <DirectoryCard
          dealer={{
            ...BASE,
            slug: 'sri-venkateswara',
            brandName: 'Sri Venkateswara Automobiles and Finance Private Limited',
            initials: 'SV',
            carCount: 1,
            fromPriceLabel: 'from ₹4.2 Lakh',
            yearsLabel: 'Tiruvannamalai, Tamil Nadu · 3 years',
          }}
        />
      </div>
    ),
  ],
};

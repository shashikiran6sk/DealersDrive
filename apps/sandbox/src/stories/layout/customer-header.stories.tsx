import type { PublicLocations } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CustomerHeader } from '@/components/layout/customer-header';

/**
 * DESIGN-SPEC §3.1 — the buyer chrome (C0xx). Sticky, 64px, white on a hairline.
 *
 * **The pathname is most of the state it has.** It reads `usePathname()` and
 * lights the section a visitor is in, so the `nextjs.navigation.pathname`
 * parameter is the control and there is one story per section rather than one
 * story with a knob. Its one prop is the district list the location button
 * offers — see `Layout/LocationSelector` for that component on its own.
 *
 * The rule is prefix matching, and `/` is deliberately not in the nav — the home
 * page lights nothing, because `startsWith('/cars')` is false there and the
 * wordmark on the left is already the way back.
 *
 * Two things to check by eye:
 *
 *   · **The current section is marked twice**, in colour *and* in
 *     `aria-current="page"`. Status is never carried by colour alone
 *     (DESIGN-SPEC §4.15), and here that is a navigation aid rather than a
 *     nicety: a monochrome display and a screen reader must both be able to say
 *     where the reader is.
 *   · **The nav disappears below 768px** (`hidden md:flex`), and the two
 *     buttons shorten in stages — "Dealer login" to "Login" below `lg`, and the
 *     secondary button vanishes entirely below `sm`. Switch the viewport to
 *     Mobile 375 to see the row the majority of buyers actually get.
 *
 * ── What is missing, and why ────────────────────────────────────────────────
 * The **saved-cars count** is **F087**, and needs the `SavedCarsProvider`
 * decorator this sandbox does not have yet — which is coupling **C-1**, and the
 * reason `withSavedCars` is on the decorator list in `component-sandbox.md` §8.
 * When it lands, this file gains the badge at 0/1/99 plus pre-hydration.
 *
 * The baseline's **city chip** is not missing — it is the location button, and
 * it lists districts instead. `LocationSelector`'s own stories say why.
 * ───────────────────────────────────────────────────────────────────────────
 */
const LOCATIONS: PublicLocations = {
  districts: [
    { slug: 'vellore', name: 'Vellore', count: 11 },
    { slug: 'ranipet', name: 'Ranipet', count: 11 },
    { slug: 'tirupattur', name: 'Tirupattur', count: 8 },
  ],
  total: 30,
};

const meta = {
  title: 'Layout/CustomerHeader',
  component: CustomerHeader,
  args: { locations: LOCATIONS },
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/' } },
  },
  decorators: [
    (Story) => (
      // A strip of page under it, so the hairline and the sticky offset read as
      // a header rather than as a floating bar.
      <div style={{ minHeight: 220, background: 'var(--color-bg, #f4f5f7)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CustomerHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The home page. Nothing in the nav is current — by design, not by omission. */
export const Home: Story = {};

export const BuyCars: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/cars' } } },
};

export const Dealers: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/dealers' } } },
};

/**
 * A dealer's portfolio (**F086**). Prefix matching is what keeps *Dealers* lit
 * on a page whose path is two segments deeper — the same rule `AdminNav` uses,
 * and the reason it is a prefix rather than an exact match.
 */
export const DealerPortfolio: Story = {
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/dealers/sri-lakshmi-motors' } },
  },
};

export const SavedCars: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/saved' } } },
};

/** Below 768px the nav is gone and the secondary button with it. */
export const Mobile: Story = {
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/cars' } },
    viewport: { defaultViewport: 'mobile' },
  },
};

/** Between `sm` and `lg`: the nav is back, the button labels are still short. */
export const Tablet: Story = {
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/cars' } },
    viewport: { defaultViewport: 'tablet' },
  },
};

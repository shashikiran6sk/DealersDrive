import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ConsoleNav, ConsoleTabBar, DEALER_NAV, LANDED_NAV } from '@/components/dealer/console-nav';

/**
 * DESIGN-SPEC §3.11 — the dealer console's sidebar nav (C025).
 *
 * **The pathname is half the component.** `ConsoleNav` takes its items as a
 * prop but reads `usePathname()` to decide which of them is current, so a story
 * that does not set `nextjs.navigation.pathname` is showing exactly one of its
 * states. That is why this file has one story per route rather than one story
 * with a knob.
 *
 * The rule is not "starts with", uniformly. `/dealer` is a prefix of every
 * console path, so Dashboard would be current on every screen; it matches
 * exactly and the rest match by prefix — which is what keeps Inventory lit on
 * `/dealer/inventory/{id}`.
 *
 * The rows are `.dd-nav-item`, the shared class, on the white sidebar it was
 * tuned for. `AdminNav` styles itself with utilities instead precisely because
 * these colours are wrong on cobalt-900 — see its own story.
 *
 * ## Two lists, and why the shell renders the shorter one
 *
 * `DEALER_NAV` is the baseline's six items and is what this component is *for*.
 * `LANDED_NAV` is the subset whose routes exist today — Dashboard and Dealer
 * profile, since **F048**. The shell renders `LANDED_NAV` because a nav item
 * onto a 404 is the console telling a dealer a page exists and then not having
 * it, and each of F050, F051, F056 and F065 deletes its own line from the set
 * as it lands.
 *
 * `Full` is the component as it will be. `AsTheConsoleRendersItToday` is what a
 * dealer actually sees, and the gap between the two stories is the
 * reconstruction, drawn.
 */
const meta = {
  title: 'Dealer/ConsoleNav',
  component: ConsoleNav,
  args: { items: DEALER_NAV },
  parameters: {
    layout: 'centered',
    nextjs: { appDirectory: true, navigation: { pathname: '/dealer' } },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 214, padding: 12, background: '#fff' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConsoleNav>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The landing page. Dashboard is current by an exact match, not a prefix one. */
export const Full: Story = {};

export const Inventory: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/dealer/inventory' } } },
};

/**
 * A car being edited. Inventory stays current — the prefix match is what keeps
 * a nav from going blank the moment you open a record, which is exactly when a
 * dealer most wants to know where they are.
 */
export const EditingAVehicle: Story = {
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/dealer/inventory/3c8f2b10-2222' } },
  },
};

export const Billing: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/dealer/billing' } } },
};

export const Profile: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/dealer/profile' } } },
};

/**
 * A path under no nav item at all. Nothing is current, and nothing is
 * *arbitrarily* current — the failure worth checking, because a "starts with
 * `/dealer`" rule would light Dashboard here.
 */
export const NothingCurrent: Story = {
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/dealer/saved-searches' } },
  },
};

/**
 * What the console renders today: two items, because two routes exist.
 *
 * Worth looking at rather than assuming. A sidebar with two rows is still a
 * thin thing — the credits panel below it carries a good deal of the sidebar's
 * weight — but it is no longer a sidebar with nowhere to go, which is what
 * **F048** changed.
 */
export const AsTheConsoleRendersItToday: Story = {
  args: { items: LANDED_NAV },
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/dealer' } } },
};

/**
 * C026 — the 56px bottom tab bar, below 768.
 *
 * It is `md:hidden`, so it cannot be seen at all at a desktop viewport: use the
 * 375 and 768 viewport controls, and check that it appears at one and is gone
 * at the other. Fixed to the bottom of the *viewport*, which in the sandbox is
 * the preview iframe.
 *
 * Five tabs, not six. An item earns a tab by having a `short`, and `Dealer
 * profile` has none — below 768 it stays in the sidebar's territory rather than
 * taking a fifth of a bar that a dealer's thumb has to hit.
 *
 * **That rule is suspended while the bar is under-full** (**F048**). The
 * sidebar is `hidden md:flex`, so this bar is the only navigation a phone has,
 * and applying the rule literally today would give one tab and no way to reach
 * `/dealer/profile` at all. `TabBarAsTheConsoleRendersItToday` is that
 * accommodation; this story is the bar the spec draws, and the two converge
 * when the fifth route lands.
 */
export const TabBar: StoryObj<typeof ConsoleTabBar> = {
  render: () => <ConsoleTabBar items={DEALER_NAV} />,
  args: { items: DEALER_NAV },
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
    nextjs: { appDirectory: true, navigation: { pathname: '/dealer/inventory' } },
  },
  decorators: [(Story) => <Story />],
};

/**
 * The same bar on the shell's own list — **two** tabs today.
 *
 * `Home` earns its place the ordinary way, by carrying a `short`. `Dealer
 * profile` is there because the bar is short of its five and the sidebar is
 * hidden at this width: without it there would be a console screen a dealer on
 * a phone simply could not reach. It drops out on its own when the fifth item
 * lands.
 */
export const TabBarAsTheConsoleRendersItToday: StoryObj<typeof ConsoleTabBar> = {
  render: () => <ConsoleTabBar items={LANDED_NAV} />,
  args: { items: LANDED_NAV },
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
    nextjs: { appDirectory: true, navigation: { pathname: '/dealer' } },
  },
  decorators: [(Story) => <Story />],
};

/** Handed nothing, it renders nothing rather than an empty 56px strip. */
export const TabBarWithNothingLanded: StoryObj<typeof ConsoleTabBar> = {
  render: () => (
    <div style={{ padding: 18, fontSize: 13, color: '#6b7280' }}>
      <ConsoleTabBar items={[]} />
      Nothing renders: an empty 56px strip pinned over every screen is a reconstruction artefact
      rather than a state of the product.
    </div>
  ),
  args: { items: [] },
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
    nextjs: { appDirectory: true, navigation: { pathname: '/dealer' } },
  },
  decorators: [(Story) => <Story />],
};

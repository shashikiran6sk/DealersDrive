import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ADMIN_NAV, AdminNav, LANDED_ADMIN_NAV } from '@/components/admin/admin-nav';

/**
 * DESIGN-SPEC §3.17 — the admin sidebar nav (C024), on the cobalt-900 field.
 *
 * **The pathname is most of the component.** `AdminNav` reads `usePathname()`
 * and decides which item is current; the only way to see any state other than
 * the default is to tell the router where it is. The
 * `nextjs.navigation.pathname` parameter is that control, and it is why this
 * file has one story per route rather than one story with a knob.
 *
 * ## Two lists, and why the shell renders the shorter one (F048)
 *
 * `ADMIN_NAV` is the baseline's five items and is what the console will be.
 * `items` defaults to `LANDED_ADMIN_NAV` — the subset whose routes exist —
 * because `/admin/listings` (**F069**) and `/admin/payments` (**F053**) do not,
 * and two of five items in a cross-tenant operations console leading to a 404
 * is the mistake the dealer console has never made.
 *
 * The stories below pass `ADMIN_NAV` so every route's current state can be
 * seen; `AsTheConsoleRendersItToday` is what an operator actually gets, and the
 * gap between it and `Dashboard` is the reconstruction, drawn.
 *
 * The rule it implements is not "starts with", uniformly: `/admin` would then
 * be current on every page, since every admin path starts with it. Dashboard
 * matches exactly and the rest match by prefix — which is what lets
 * `/admin/dealers/{id}` keep Dealers lit.
 *
 * The colours live here rather than in the shared `.dd-nav-item` class: those
 * are tuned for the white dealer sidebar, and overriding them per-consumer in
 * six places is how a design system starts disagreeing with itself.
 */
const meta = {
  title: 'Admin/AdminNav',
  component: AdminNav,
  args: { items: ADMIN_NAV },
  parameters: {
    layout: 'centered',
    nextjs: { appDirectory: true, navigation: { pathname: '/admin' } },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 206, padding: 18, background: 'var(--color-accent-900, #10243f)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdminNav>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The landing page. Dashboard is current by an exact match, not a prefix one. */
export const Dashboard: Story = {};

export const Listings: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/admin/listings' } } },
};

export const Dealers: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/admin/dealers' } } },
};

/**
 * A dealership detail page. Dealers stays current — the prefix match is what
 * keeps a nav from going blank the moment you open a record, which is exactly
 * when an operator most wants to know where they are.
 */
export const DealerDetail: Story = {
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/admin/dealers/3c8f2b10-2222' } },
  },
};

export const Payments: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/admin/payments' } } },
};

export const Configuration: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/admin/config' } } },
};

/**
 * A path under no nav item at all. Nothing is current, and nothing is
 * *arbitrarily* current — the failure mode worth checking, because a "starts
 * with `/admin`" rule would light Dashboard here.
 */
export const NothingCurrent: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/admin/audit-logs' } } },
};

/**
 * What an operator actually sees (**F048**): three items, because three routes
 * exist. Listings and Payments return with F069 and F053.
 *
 * Worth looking at beside `Dashboard` above rather than assuming — the sidebar
 * is noticeably shorter, and the note pinned to its foot is carrying more of
 * the panel than it was designed to.
 */
export const AsTheConsoleRendersItToday: Story = {
  args: { items: LANDED_ADMIN_NAV },
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/admin' } } },
};

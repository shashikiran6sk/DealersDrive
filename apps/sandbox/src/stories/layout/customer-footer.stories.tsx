import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CustomerFooter } from '@/components/layout/customer-footer';

/**
 * The buyer footer (C0xx) — quiet by design: a hairline, a wordmark, and the
 * sentence the whole product rests on.
 *
 * That sentence is the state worth looking at. "Every vehicle is owned, priced
 * and warranted by the dealer who lists it" is the marketplace's legal posture
 * in one line (§16.1) — Dealers-Drive verifies who the dealer is, and does not
 * sell the car — so it belongs on every buyer page rather than in a terms
 * document nobody opens.
 *
 * It takes no props and reads nothing, which is why it is a **server**
 * component and ships no JavaScript. The only thing that varies is the width:
 * the nav floats right on a wide viewport and wraps under the paragraph on a
 * narrow one.
 */
const meta = {
  title: 'Layout/CustomerFooter',
  component: CustomerFooter,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CustomerFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The wrap. Below `sm` the link row drops under the paragraph rather than beside it. */
export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile' } },
};

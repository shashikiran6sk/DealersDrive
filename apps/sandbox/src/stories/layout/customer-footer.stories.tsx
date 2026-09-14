import type { SocialLink } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CustomerFooter } from '@/components/layout/customer-footer';

/**
 * The buyer footer (C021), as **R44** rebuilt it.
 *
 * It used to be one row — a wordmark, the sentence the marketplace rests on,
 * and four links floated right. That is the right footer for a product with
 * four pages and the wrong one for a product a buyer is asked to hand a phone
 * number to: there was nowhere to find out how to reach a person, and nowhere
 * the platform could be seen to exist off the platform.
 *
 * Two things about it are worth looking at rather than reading:
 *
 * **The social row is configuration.** The links come from `platform_config`
 * via `GET /v1/config/public`, so what this component receives depends on what
 * an operator has published at `/admin/config` — and the interesting state is
 * the empty one, because that is what a fresh deployment looks like.
 *
 * **The columns claim only what exists.** Every route here is one
 * `CustomerHeader` also offers; the footer invents no About, Terms or Careers
 * page to square the columns off, because a footer link onto a 404 is the
 * product telling a buyer a page exists and then not having it.
 *
 * It takes props but still reads nothing and handles nothing, so it remains a
 * **server** component that ships no JavaScript (invariant 8).
 */
const SOCIAL: SocialLink[] = [
  { network: 'instagram', label: 'Instagram', href: 'https://instagram.com/dealersdrive' },
  { network: 'facebook', label: 'Facebook', href: 'https://facebook.com/dealersdrive' },
  { network: 'youtube', label: 'YouTube', href: 'https://youtube.com/@dealersdrive' },
  { network: 'linkedin', label: 'LinkedIn', href: 'https://linkedin.com/company/dealersdrive' },
  { network: 'x', label: 'X', href: 'https://x.com/dealersdrive' },
  { network: 'whatsapp', label: 'WhatsApp', href: 'https://wa.me/914162248890' },
];

const meta = {
  title: 'Layout/CustomerFooter',
  component: CustomerFooter,
  parameters: { layout: 'fullscreen' },
  args: {
    social: SOCIAL,
    supportEmail: 'support@dealers-drive.com',
    supportPhone: '+914162248890',
  },
  argTypes: {
    social: { control: 'object' },
    supportEmail: { control: 'text' },
    supportPhone: { control: 'text' },
  },
} satisfies Meta<typeof CustomerFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Everything published: six marks, both contacts, four columns. */
export const Default: Story = {};

/**
 * **A fresh deployment.** No social account has been published yet, so the row
 * is absent entirely rather than a set of icons pointing at a platform's own
 * homepage — which is what a hard-coded default would be.
 */
export const NoSocialAccounts: Story = {
  args: { social: [] },
};

/** Two networks. The row is a row, not a grid — it is sized by what it holds. */
export const TwoNetworks: Story = {
  args: { social: SOCIAL.slice(0, 2) },
};

/**
 * **What the API being unreachable looks like** (`NO_PUBLIC_CONFIG`). The
 * layout degrades rather than throwing — a throw there escapes every boundary
 * below the root — so the footer loses the contacts and the social row and
 * keeps its links and its trust line.
 */
export const ApiUnreachable: Story = {
  args: { social: [], supportEmail: '', supportPhone: '' },
};

/** The four columns become two at 640 and one below it, brand block first. */
export const Tablet: Story = {
  parameters: { viewport: { defaultViewport: 'tablet' } },
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile' } },
};

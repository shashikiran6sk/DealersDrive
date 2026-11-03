import type { SocialLink } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CustomerFooter } from '@/components/layout/customer-footer';

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
    popular: { control: 'object' },
  },
} satisfies Meta<typeof CustomerFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PopularSearches: Story = {
  args: {
    popular: [
      { href: '/cars?district=vellore', label: 'Used Cars in Vellore' },
      { href: '/used-cars/vellore/maruti-suzuki', label: 'Used Maruti Suzuki Cars in Vellore' },
      { href: '/used-cars/katpadi', label: 'Used Cars in Katpadi' },
      { href: '/used-cars/vellore/suv', label: 'Used SUV Cars in Vellore' },
      { href: '/used-cars/vellore/under-5-lakh', label: 'Used Cars Under ₹5 lakh in Vellore' },
      { href: '/used-cars/vellore/diesel', label: 'Used Diesel Cars in Vellore' },
    ],
  },
};

export const NoSocialAccounts: Story = {
  args: { social: [] },
};

export const TwoNetworks: Story = {
  args: { social: SOCIAL.slice(0, 2) },
};

export const ApiUnreachable: Story = {
  args: { social: [], supportEmail: '', supportPhone: '' },
};

export const Tablet: Story = {
  parameters: { viewport: { defaultViewport: 'tablet' } },
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile' } },
};

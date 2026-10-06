import type { SupportContacts } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SupportCard, SupportPage, SupportRequestCallout } from '@/features/support/support-page';

const SUPPORT: SupportContacts = {
  customer: { email: 'support@dealers-drive.com', phone: '+914162248890' },
  dealer: { email: 'dealers@dealers-drive.com', phone: '+914162248891' },
  whatsappHref: 'https://wa.me/914162248890',
};

const meta = {
  title: 'Layout/SupportPage',
  component: SupportPage,
  parameters: { layout: 'fullscreen' },
  args: { support: SUPPORT },
  argTypes: { support: { control: 'object' } },
} satisfies Meta<typeof SupportPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WhatsappNotConfigured: Story = {
  args: { support: { ...SUPPORT, whatsappHref: null } },
};

export const DeploymentFallbackOnly: Story = {
  args: {
    support: {
      customer: { email: 'support@dealers-drive.com', phone: '+914162248890' },
      dealer: { email: 'support@dealers-drive.com', phone: '+914162248890' },
      whatsappHref: null,
    },
  },
};

export const LongAddress: Story = {
  args: {
    support: {
      ...SUPPORT,
      customer: {
        email: 'customer-care-and-marketplace-support@dealers-drive.example.org',
        phone: '+91 98400 12345',
      },
    },
  },
};

export const PhoneWidth: Story = {
  parameters: { viewport: { defaultViewport: 'mobile' } },
};

export const SingleCard: StoryObj<typeof SupportCard> = {
  render: () => (
    <div className="max-w-[360px] p-6">
      <SupportCard
        icon="customer"
        headingId="story-support-card"
        title="Customer support"
        body="Help with browsing, saved cars, enquiries, and your customer account."
      >
        <a href="mailto:support@dealers-drive.com" className="font-extrabold underline">
          support@dealers-drive.com
        </a>
      </SupportCard>
    </div>
  ),
};

export const SupportRequestCalloutOnly: StoryObj<typeof SupportRequestCallout> = {
  render: () => <SupportRequestCallout />,
};

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { userEvent, within } from 'storybook/test';

import { enquiryActionStub } from '../../mocks/enquiry-actions';

import { PriceBlock } from '@/components/vehicle/price-block';
import { EnquiryForm, EnquiryPanel } from '@/features/enquiry/enquiry-panel';

const CUSTOMER = { fullName: 'Shashikiran', phoneDisplay: '+91 98400 12345' };

const meta = {
  title: 'Vehicle/EnquiryPanel',
  component: EnquiryPanel,
  parameters: {
    layout: 'padded',
    nextjs: { appDirectory: true, navigation: { pathname: '/car/2023-hyundai-creta-sx-o' } },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, margin: '24px auto', display: 'grid', gap: 16 }}>
        <PriceBlock priceLabel="₹14,50,000" negotiabilityLabel="Negotiable" />
        <Story />
      </div>
    ),
  ],
  argTypes: {
    autoOpen: { control: 'boolean' },
  },
  args: {
    listingSlug: '2023-hyundai-creta-sx-o',
    dealerName: 'Sri Lakshmi Motors',
    autoOpen: false,
  },
  beforeEach: () => {
    enquiryActionStub.customer = CUSTOMER;
    enquiryActionStub.result = {
      status: 'sent',
      receipt: {
        id: 'enquiry-1',
        status: 'NEW',
        createdAt: '2026-09-28T10:30:00.000Z',
        dealerName: 'Sri Lakshmi Motors',
        vehicleTitle: '2023 Hyundai Creta SX(O)',
      },
    };
  },
} satisfies Meta<typeof EnquiryPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const SignedOut: Story = {
  beforeEach: () => {
    enquiryActionStub.customer = null;
  },
};

export const Form: Story = { args: { autoOpen: true } };

async function pressSend(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(await canvas.findByRole('button', { name: 'Send enquiry' }));
}

export const Sent: Story = {
  args: { autoOpen: true },
  play: async ({ canvasElement }) => {
    await pressSend(canvasElement);
  },
};

export const AlreadySent: Story = {
  args: { autoOpen: true },
  beforeEach: () => {
    enquiryActionStub.result = {
      status: 'refused',
      code: 'ENQUIRY_ALREADY_SUBMITTED_RECENTLY',
      message:
        'You enquired about this car in the last day — the dealership already has your details and will call you.',
    };
  },
  play: async ({ canvasElement }) => {
    await pressSend(canvasElement);
  },
};

export const NoLongerAvailable: Story = {
  args: { autoOpen: true },
  beforeEach: () => {
    enquiryActionStub.result = {
      status: 'refused',
      code: 'LISTING_NOT_AVAILABLE',
      message:
        'This car is no longer available, so the dealership is not taking enquiries about it.',
    };
  },
  play: async ({ canvasElement }) => {
    await pressSend(canvasElement);
  },
};

export const FormRateLimited: Story = {
  render: (args) => (
    <EnquiryForm
      customer={CUSTOMER}
      dealerName={args.dealerName}
      onSend={() =>
        Promise.resolve({
          status: 'refused',
          code: 'ENQUIRY_RATE_LIMITED',
          message: 'You have sent a lot of enquiries. Try again in a little while.',
        })
      }
      onCancel={() => undefined}
    />
  ),
};

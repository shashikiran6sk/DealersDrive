import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SupportRequestDetail } from '@/features/support/support-requests';

import { SUPPORT_TICKET } from './support-requests.stories';

const CONVERSATION = {
  ...SUPPORT_TICKET,
  messages: [
    {
      id: '55555555-5555-4555-8555-555555555555',
      author: 'SUPPORT' as const,
      authorLabel: 'Dealers-Drive support',
      body: 'Thanks for telling us. We have asked the dealership to call you today. Which number should they use?',
      createdAt: '2026-09-30T10:00:00.000Z',
      createdLabel: '30 Sep 2026, 15:30',
    },
  ],
  enquiry: {
    id: '22222222-2222-4222-8222-222222222222',
    vehicleTitle: '2021 Honda City VX',
    dealerName: 'Sri Lakshmi Motors',
    statusLabel: 'Sent',
    sentLabel: '27 Sep 2026',
    vehicleHref: '/car/2021-honda-city-vx',
  },
};

const meta = {
  title: 'Support/SupportRequestDetail',
  component: SupportRequestDetail,
  parameters: { layout: 'padded' },
  args: { ticket: CONVERSATION },
} satisfies Meta<typeof SupportRequestDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AwaitingYourReply: Story = {};

export const JustCreated: Story = {
  args: {
    ticket: { ...SUPPORT_TICKET, status: 'OPEN', statusLabel: 'Open', statusTone: 'accent' },
  },
};

export const Resolved: Story = {
  args: {
    ticket: { ...CONVERSATION, status: 'RESOLVED', statusLabel: 'Resolved', statusTone: 'ok' },
  },
};

export const Closed: Story = {
  args: {
    ticket: {
      ...CONVERSATION,
      status: 'CLOSED',
      statusLabel: 'Closed',
      statusTone: 'neutral',
      canReply: false,
    },
  },
};

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };

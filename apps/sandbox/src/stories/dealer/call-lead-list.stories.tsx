import type { CallLead } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CallLeadList } from '@/components/leads/call-lead-list';

const RAVI: CallLead = {
  id: '11111111-1111-4111-8111-111111111111',
  customer: {
    name: 'Ravi Kumar',
    initials: 'RK',
    phoneDisplay: '+91 98400 12345',
    callHref: 'tel:+919840012345',
  },
  vehicle: {
    title: '2023 Hyundai Creta SX(O)',
    registrationDisplay: 'TN 01 AB 1234',
    href: '/car/hyundai-creta-2023',
  },
  revealCount: 1,
  firstRevealedLabel: '26 Oct 2026',
  lastRevealedAt: '2026-10-28T10:00:00.000Z',
  lastRevealedAgoLabel: '2 hr ago',
};

const PRIYA: CallLead = {
  ...RAVI,
  id: '22222222-2222-4222-8222-222222222222',
  customer: {
    name: 'Priya Sundaram',
    initials: 'PS',
    phoneDisplay: '+91 94440 67890',
    callHref: 'tel:+919444067890',
  },
  vehicle: {
    title: '2019 Maruti Suzuki Swift VXi',
    registrationDisplay: 'TN 23 CD 5678',
    href: '/car/maruti-swift-2019',
  },
  revealCount: 3,
  firstRevealedLabel: '12 Oct 2026',
  lastRevealedAgoLabel: 'Yesterday',
};

const meta = {
  title: 'Dealer/CallLeadList',
  component: CallLeadList,
  argTypes: {
    audience: { control: 'inline-radio', options: ['dealer', 'admin'] },
  },
  args: {
    leads: [RAVI, PRIYA],
    audience: 'dealer',
    nextHref: null,
  },
} satisfies Meta<typeof CallLeadList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dealer: Story = {};

export const Admin: Story = {
  args: {
    audience: 'admin',
    leads: [
      { ...RAVI, dealer: { name: 'Sri Lakshmi Motors', slug: 'sri-lakshmi-motors' } },
      { ...PRIYA, dealer: { name: 'Vellore Car Bazaar', slug: 'vellore-car-bazaar' } },
    ],
  },
};

export const Empty: Story = { args: { leads: [] } };

export const More: Story = { args: { nextHref: '/dealer/enquiries/calls?cursor=next' } };

export const CardStates: Story = {
  args: {
    leads: [
      RAVI,
      PRIYA,
      {
        ...RAVI,
        id: '33333333-3333-4333-8333-333333333333',
        customer: { ...RAVI.customer, phoneDisplay: null, callHref: null },
        vehicle: { ...RAVI.vehicle, href: null },
      },
    ],
  },
};

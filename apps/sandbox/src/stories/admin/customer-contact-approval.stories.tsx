import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CustomerContactApproval } from '@/features/admin/customer-contact-approval';

const meta = {
  title: 'Admin/CustomerContactApproval',
  component: CustomerContactApproval,
  parameters: { layout: 'padded' },
  args: {
    dealerId: '7d1e2f3a-4b5c-4d6e-8f70-81a2b3c4d5e6',
    landline: '9677902626',
    approvedAt: null,
  },
} satisfies Meta<typeof CustomerContactApproval>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AwaitingApproval: Story = {};

export const Approved: Story = {
  args: { landline: '+919677902626', approvedAt: '2026-10-30T09:15:00.000Z' },
};

export const NoNumber: Story = { args: { landline: null } };

export const InvalidNumber: Story = { args: { landline: 'call the yard' } };

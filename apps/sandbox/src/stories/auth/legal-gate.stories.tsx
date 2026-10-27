import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LegalGate } from '@/features/legal/legal-gate';
const meta = {
  title: 'Auth/LegalGate',
  component: LegalGate,
  parameters: { layout: 'fullscreen' },
  args: { scope: 'CUSTOMER', returnTo: '/', canAccept: true },
} satisfies Meta<typeof LegalGate>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Customer: Story = {};
export const Dealer: Story = { args: { scope: 'DEALER', returnTo: '/dealer' } };
export const OwnerRequired: Story = { args: { scope: 'DEALER', canAccept: false } };

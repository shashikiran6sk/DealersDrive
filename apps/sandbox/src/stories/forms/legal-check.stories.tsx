import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LegalCheck } from '@/components/forms/legal-check';
const meta = {
  title: 'Forms/LegalCheck',
  component: LegalCheck,
  parameters: { layout: 'padded' },
  args: { disabled: false },
} satisfies Meta<typeof LegalCheck>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Unchecked: Story = {};
export const Disabled: Story = { args: { disabled: true } };

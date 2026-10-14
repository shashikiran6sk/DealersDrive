import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LegalCheck } from '@/features/legal/legal-check';
import { LegalProvider } from '@/features/legal/legal-provider';
const meta = {
  title: 'Forms/LegalCheck',
  component: LegalCheck,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <LegalProvider enabled>
        <div style={{ maxWidth: 600 }}>
          <Story />
        </div>
      </LegalProvider>
    ),
  ],
  args: { kind: 'account' },
} satisfies Meta<typeof LegalCheck>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Account: Story = {};
export const Dealer: Story = { args: { kind: 'dealer' } };
export const Enquiry: Story = { args: { kind: 'enquiry', dealerName: 'Fixture Motors' } };
export const Certification: Story = { args: { kind: 'certification' } };

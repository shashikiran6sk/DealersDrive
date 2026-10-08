import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LegalDocument } from '@/features/legal/legal-document';
const meta = {
  title: 'Layout/LegalDocument',
  component: LegalDocument,
  parameters: { layout: 'fullscreen' },
  args: { documentId: 'terms' },
} satisfies Meta<typeof LegalDocument>;
export default meta;
type Story = StoryObj<typeof meta>;
export const DraftTerms: Story = {};
export const Privacy: Story = { args: { documentId: 'privacy' } };
export const DealerAgreement: Story = { args: { documentId: 'dealer' } };
export const Archived: Story = { args: { archived: true } };
export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };

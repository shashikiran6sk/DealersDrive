import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TERMS_V1, PRIVACY_V1 } from '@dealers-drive/contracts';
import { LegalDocument } from '@/components/layout/legal-document';
const meta = {
  title: 'Layout/LegalDocument',
  component: LegalDocument,
  parameters: { layout: 'fullscreen' },
  args: { document: TERMS_V1 },
} satisfies Meta<typeof LegalDocument>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Terms: Story = {};
export const Privacy: Story = { args: { document: PRIVACY_V1 } };

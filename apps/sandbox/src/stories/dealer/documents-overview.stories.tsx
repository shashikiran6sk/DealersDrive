import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import {
  BUSINESS_IN_REVIEW,
  BUSINESS_REJECTED,
  BUSINESS_VERIFIED,
  DOCUMENTS_GSTIN,
  PERSONAL_VERIFIED,
} from '../../mocks/dealer-documents';

import { DocumentsOverview } from '@/features/dealer/documents-overview';

const meta = {
  title: 'Dealer/DocumentsOverview',
  component: DocumentsOverview,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  argTypes: {
    documents: {
      control: 'object',
      description: 'The dealership’s documents (`DealerDocumentsResponse.data`).',
    },
    gstin: {
      control: 'text',
      description:
        'The GSTIN on file, or null. With one, the business proof must be its GST certificate.',
    },
    dealerStatus: {
      control: 'select',
      options: ['ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL', 'DRAFT', 'REJECTED', 'CLOSED'],
      description:
        'An ACTIVE dealership with documents outstanding hears that its activation can be withdrawn.',
    },
  },
  args: {
    documents: [PERSONAL_VERIFIED, BUSINESS_VERIFIED],
    gstin: DOCUMENTS_GSTIN,
    dealerStatus: 'ACTIVE',
  },
} satisfies Meta<typeof DocumentsOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllVerified: Story = {};

export const ManualActivationBothOutstanding: Story = {
  args: { documents: [], gstin: null },
};

export const OneRejected: Story = {
  args: { documents: [PERSONAL_VERIFIED, BUSINESS_REJECTED], gstin: null },
};

export const OneInReview: Story = {
  args: { documents: [PERSONAL_VERIFIED, BUSINESS_IN_REVIEW] },
};

export const Mobile: Story = {
  args: { documents: [], gstin: null },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

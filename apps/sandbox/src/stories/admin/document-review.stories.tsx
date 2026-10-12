import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DocumentReview } from '@/features/admin/document-review';

import { adminActionStub } from '../../mocks/admin-actions';
import {
  DOCUMENT_HISTORY,
  OTHER_CERTIFICATE,
  PERSONAL_PAN,
  adminDocument,
} from '../../mocks/admin-dealer';

const meta = {
  title: 'Admin/DocumentReview',
  component: DocumentReview,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => {
      adminActionStub.delayMs = 900;
      adminActionStub.result = { ok: true };
      adminActionStub.calls = [];
      return (
        <div style={{ maxWidth: 640, background: '#fff', padding: 16 }}>
          <Story />
        </div>
      );
    },
  ],
  argTypes: {
    documents: { control: 'object' },
    gaps: { control: 'object' },
    history: { control: 'object' },
  },
  args: {
    documents: [adminDocument()],
    dealerSlug: 'sri-lakshmi-motors-vellore-tamil-nadu',
    gaps: ['PERSONAL_IDENTITY'],
    history: [],
  },
} satisfies Meta<typeof DocumentReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const AwaitingDecision: Story = {
  args: {
    documents: [PERSONAL_PAN, adminDocument()],
    gaps: ['PERSONAL_IDENTITY', 'BUSINESS_IDENTITY'],
    history: DOCUMENT_HISTORY,
  },
};

export const OtherCertificateWithDescription: Story = {
  args: {
    documents: [PERSONAL_PAN, OTHER_CERTIFICATE],
    gaps: ['PERSONAL_IDENTITY', 'GST_CERTIFICATE'],
  },
};

export const MixedStates: Story = {
  args: {
    documents: [
      { ...PERSONAL_PAN, status: 'VERIFIED', reviewedAt: '2026-09-02T08:00:00.000Z' },
      adminDocument({
        status: 'REJECTED',
        fileName: null,
        mimeType: null,
        bytes: null,
        viewUrl: null,
        viewUrlExpiresAt: null,
        submissionCount: 2,
        reviewedAt: '2026-09-03T09:10:00.000Z',
        rejectionReason: 'The GSTIN on the certificate does not match the one on file.',
      }),
    ],
    gaps: ['BUSINESS_IDENTITY'],
    history: DOCUMENT_HISTORY,
  },
};

export const VerifiedAndRevocable: Story = {
  args: {
    documents: [
      { ...PERSONAL_PAN, status: 'VERIFIED', reviewedAt: '2026-09-02T08:00:00.000Z' },
      adminDocument({ status: 'VERIFIED', reviewedAt: '2026-09-02T08:05:00.000Z' }),
    ],
    gaps: [],
    history: DOCUMENT_HISTORY,
  },
};

export const LegacySupportingSlot: Story = {
  args: {
    documents: [
      PERSONAL_PAN,
      adminDocument({
        id: '00000000-0000-4000-8000-000000000013',
        category: 'SUPPORTING',
        categoryLabel: 'Supporting document',
        type: 'ADDRESS_PROOF',
        label: 'Address proof',
        fileName: 'lease.pdf',
      }),
    ],
    gaps: ['BUSINESS_IDENTITY'],
  },
};

export const Empty: Story = {
  args: { documents: [], gaps: ['PERSONAL_IDENTITY', 'BUSINESS_IDENTITY'] },
};

export const Deciding: Story = {
  decorators: [
    (Story) => {
      adminActionStub.delayMs = 8_000;
      adminActionStub.result = { ok: true };
      return <Story />;
    },
  ],
};

export const ServerError: Story = {
  decorators: [
    (Story) => {
      adminActionStub.delayMs = 400;
      adminActionStub.result = {
        ok: false,
        message: 'This action needs the admin:dealer:approve permission.',
      };
      return <Story />;
    },
  ],
};

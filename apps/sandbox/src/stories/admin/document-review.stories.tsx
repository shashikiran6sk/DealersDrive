import type { AdminDealerDetail } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DocumentReview } from '@/features/admin/document-review';

import { adminActionStub } from '../../mocks/admin-actions';

type Document = AdminDealerDetail['documents'][number];

function document(overrides: Partial<Document> = {}): Document {
  return {
    id: '00000000-0000-4000-8000-000000000010',
    type: 'GST_CERTIFICATE',
    label: 'GST certificate',
    status: 'UPLOADED',
    fileName: 'gst-certificate.pdf',
    bytes: 284_112,
    uploadedAt: '2026-09-01T10:22:00.000Z',
    viewUrl: 'https://storage.example/signed/gst-certificate.pdf',
    viewUrlExpiresAt: '2026-09-01T10:37:00.000Z',
    rejectionReason: null,
    ...overrides,
  };
}

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
  argTypes: { documents: { control: 'object' } },
  args: {
    documents: [document()],
    dealerSlug: 'sri-lakshmi-motors-vellore-tamil-nadu',
  },
} satisfies Meta<typeof DocumentReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const AwaitingDecision: Story = {
  args: {
    documents: [
      document(),
      document({
        id: '00000000-0000-4000-8000-000000000011',
        type: 'PAN_CARD',
        label: 'PAN card',
        fileName: 'pan.jpg',
      }),
      document({
        id: '00000000-0000-4000-8000-000000000012',
        type: 'ADDRESS_PROOF',
        label: 'Address proof',
        fileName: 'lease.pdf',
      }),
    ],
  },
};

export const MixedStates: Story = {
  args: {
    documents: [
      document({ status: 'VERIFIED' }),
      document({
        id: '00000000-0000-4000-8000-000000000011',
        type: 'PAN_CARD',
        label: 'PAN card',
        status: 'REJECTED',
        rejectionReason: 'The name on the PAN does not match the GST certificate.',
      }),
      document({
        id: '00000000-0000-4000-8000-000000000012',
        type: 'ADDRESS_PROOF',
        label: 'Address proof',
        status: 'REQUIRED',
        fileName: null,
        bytes: null,
        uploadedAt: null,
        viewUrl: null,
        viewUrlExpiresAt: null,
      }),
    ],
  },
};

export const AllVerified: Story = {
  args: {
    documents: [
      document({ status: 'VERIFIED' }),
      document({
        id: '00000000-0000-4000-8000-000000000011',
        type: 'PAN_CARD',
        label: 'PAN card',
        status: 'VERIFIED',
      }),
      document({
        id: '00000000-0000-4000-8000-000000000012',
        type: 'ADDRESS_PROOF',
        label: 'Address proof',
        status: 'VERIFIED',
      }),
    ],
  },
};

export const Empty: Story = { args: { documents: [] } };

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

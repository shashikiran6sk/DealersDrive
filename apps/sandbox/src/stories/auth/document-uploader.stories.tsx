import type { DealerDocumentDto } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DocumentUploader } from '@/features/auth/document-uploader';

function document(overrides: Partial<DealerDocumentDto> = {}): DealerDocumentDto {
  return {
    id: null,
    type: 'GST_CERTIFICATE',
    label: 'GST certificate',
    status: 'REQUIRED',
    statusLabel: 'Required — PDF or JPG, max 5 MB',
    fileName: null,
    uploadedAt: null,
    rejectionReason: null,
    action: 'Upload',
    ...overrides,
  };
}

const meta = {
  title: 'Forms/DocumentUploader',
  component: DocumentUploader,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560, margin: '24px auto', background: '#fff', padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: { document: { control: 'object' } },
  args: { document: document() },
} satisfies Meta<typeof DocumentUploader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Required: Story = { args: { document: document() } };

export const InReview: Story = {
  args: {
    document: document({
      id: 'doc-1',
      status: 'UPLOADED',
      statusLabel: 'gst-certificate.pdf · uploaded',
      fileName: 'gst-certificate.pdf',
      action: 'Replace',
    }),
  },
};

export const Verified: Story = {
  args: {
    document: document({
      id: 'doc-1',
      status: 'VERIFIED',
      statusLabel: 'gst-certificate.pdf · verified',
      fileName: 'gst-certificate.pdf',
      action: 'Replace',
    }),
  },
};

export const Rejected: Story = {
  args: {
    document: document({
      id: 'doc-1',
      status: 'REJECTED',
      statusLabel: 'The scan is too blurry to read. Send a clearer copy.',
      fileName: 'gst-certificate.pdf',
      rejectionReason: 'The scan is too blurry to read. Send a clearer copy.',
      action: 'Upload',
    }),
  },
};

export const Uploading: Story = {
  args: {
    document: document({
      id: 'doc-1',
      status: 'UPLOADING',
      statusLabel: 'Uploading…',
      fileName: 'gst-certificate.pdf',
      action: 'Cancel',
    }),
  },
};

export const UploadedAndRemovable: Story = {
  args: {
    document: document({
      id: 'doc-1',
      status: 'UPLOADED',
      statusLabel: 'pan.jpg · uploaded',
      fileName: 'pan.jpg',
      action: 'Replace',
    }),
  },
};

export const TheChecklist: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <DocumentUploader
        document={document({
          id: 'doc-1',
          status: 'VERIFIED',
          statusLabel: 'gst-certificate.pdf · verified',
          fileName: 'gst-certificate.pdf',
          action: 'Replace',
        })}
      />
      <DocumentUploader
        document={document({
          type: 'PAN_CARD',
          label: 'PAN card',
          id: 'doc-2',
          status: 'UPLOADED',
          statusLabel: 'pan.jpg · uploaded',
          fileName: 'pan.jpg',
          action: 'Replace',
        })}
      />
      <DocumentUploader
        document={document({
          type: 'ADDRESS_PROOF',
          label: 'Address proof',
          id: 'doc-3',
          status: 'REJECTED',
          statusLabel:
            'The electricity bill is dated more than three months ago. Send one from the last quarter.',
          rejectionReason:
            'The electricity bill is dated more than three months ago. Send one from the last quarter.',
          fileName: 'eb-bill.pdf',
          action: 'Upload',
        })}
      />
    </div>
  ),
};

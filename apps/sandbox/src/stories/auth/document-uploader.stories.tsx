import type { DealerDocumentDto } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DocumentUploader } from '@/features/auth/document-uploader';

function document(overrides: Partial<DealerDocumentDto> = {}): DealerDocumentDto {
  return {
    id: '00000000-0000-4000-8000-0000000000d1',
    category: 'BUSINESS_IDENTITY',
    categoryLabel: 'Business Identity Proof',
    type: 'GST_CERTIFICATE',
    label: 'GST Registration Certificate',
    status: 'UPLOADED',
    statusLabel: 'Submitted · awaiting review',
    fileName: 'gst-certificate.pdf',
    mimeType: 'application/pdf',
    bytes: 182_400,
    description: null,
    uploadedAt: '2026-10-12T09:00:00.000Z',
    reviewedAt: null,
    rejectionReason: null,
    submissionCount: 1,
    action: 'Replace',
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
  argTypes: {
    category: {
      control: 'inline-radio',
      options: ['PERSONAL_IDENTITY', 'BUSINESS_IDENTITY'],
      description: 'The slot this card fills. Its type list comes from DOC_CATEGORY_TYPES.',
    },
    document: {
      control: 'object',
      description: 'The document in this slot, or null when nothing has been submitted.',
    },
    gstinOnFile: {
      control: 'boolean',
      description: 'With a GSTIN on file the business proof must be the GST certificate.',
    },
    basePath: {
      control: 'text',
      description: 'The BFF base the presign, commit and delete go to (Sales passes its own).',
    },
  },
  args: { category: 'PERSONAL_IDENTITY', document: null, gstinOnFile: false },
} satisfies Meta<typeof DocumentUploader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const EmptyPersonal: Story = { args: { category: 'PERSONAL_IDENTITY', document: null } };

export const EmptyBusiness: Story = { args: { category: 'BUSINESS_IDENTITY', document: null } };

export const EmptyBusinessWithGstin: Story = {
  args: { category: 'BUSINESS_IDENTITY', document: null, gstinOnFile: true },
};

export const OtherCertificateWithDescription: Story = {
  args: {
    category: 'BUSINESS_IDENTITY',
    document: document({
      type: 'OTHER_BUSINESS_CERTIFICATE',
      label: 'Other Government-Issued Business Certificate',
      fileName: 'fire-safety.pdf',
      description: 'Fire safety certificate issued by the Vellore Corporation',
    }),
  },
};

export const InReview: Story = {
  args: { category: 'BUSINESS_IDENTITY', document: document() },
};

export const Verified: Story = {
  args: {
    category: 'PERSONAL_IDENTITY',
    document: document({
      category: 'PERSONAL_IDENTITY',
      categoryLabel: 'Personal Identity Proof',
      type: 'PAN_CARD',
      label: 'PAN Card',
      status: 'VERIFIED',
      statusLabel: 'Verified',
      fileName: 'pan.jpg',
      mimeType: 'image/jpeg',
      reviewedAt: '2026-10-13T11:00:00.000Z',
    }),
  },
};

export const RejectedWithReason: Story = {
  args: {
    category: 'PERSONAL_IDENTITY',
    document: document({
      category: 'PERSONAL_IDENTITY',
      categoryLabel: 'Personal Identity Proof',
      type: 'DRIVING_LICENCE',
      label: 'Driving Licence',
      status: 'REJECTED',
      statusLabel: 'Rejected — upload a replacement',
      fileName: 'licence.jpg',
      mimeType: 'image/jpeg',
      rejectionReason: 'The scan is too blurry to read. Send a clearer copy.',
      action: 'Resubmit',
    }),
  },
};

export const UploadUnfinished: Story = {
  args: {
    category: 'BUSINESS_IDENTITY',
    document: document({
      type: 'UDYAM',
      label: 'Udyam Registration Certificate',
      status: 'UPLOADING',
      statusLabel: 'Upload not finished — choose the file again',
      fileName: 'udyam.pdf',
      action: 'Upload again',
    }),
  },
};

export const BothCategories: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <DocumentUploader category="PERSONAL_IDENTITY" document={null} />
      <DocumentUploader category="BUSINESS_IDENTITY" document={document()} gstinOnFile />
    </div>
  ),
};

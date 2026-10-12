import type { DealerDocumentDto } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect, type ReactNode } from 'react';

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

const GSTIN = '33AABCS1429B1ZX';

const GSTIN_REFUSAL = {
  type: 'about:blank',
  title: 'Conflict',
  status: 409,
  code: 'GSTIN_ALREADY_REGISTERED',
  detail: 'That GSTIN is already registered to another dealership.',
  errors: [
    { field: 'body.gstin', code: 'GSTIN_ALREADY_REGISTERED', message: 'Already registered.' },
  ],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function RefusingCommit({ children }: { children: ReactNode }) {
  useEffect(() => {
    const real = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith('/presign')) {
        return Promise.resolve(
          json({
            documentId: '00000000-0000-4000-8000-000000000001',
            uploadUrl: 'https://storage.sandbox/put',
            method: 'PUT',
            headers: {},
            expiresInSeconds: 300,
          }),
        );
      }
      if (url.startsWith('https://storage.sandbox/')) return Promise.resolve(json({}));
      if (url.endsWith('/commit')) return Promise.resolve(json(GSTIN_REFUSAL, 409));
      return real(input);
    };
    return () => {
      window.fetch = real;
    };
  }, []);
  return <>{children}</>;
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
    gstin: {
      control: 'text',
      description:
        'The GSTIN on file, or null. Pre-fills the GSTIN box beside a GST certificate and starts the business card on that type; another business proof removes it on commit.',
    },
    basePath: {
      control: 'text',
      description: 'The BFF base the presign, commit and delete go to (Sales passes its own).',
    },
    locked: {
      control: 'boolean',
      description:
        'The API will not change this document (UPLOADED or VERIFIED outside DRAFT): no Upload, Replace or Delete, and a note saying so. The dealer Documents page sets it.',
    },
  },
  args: { category: 'PERSONAL_IDENTITY', document: null, gstin: null, locked: false },
} satisfies Meta<typeof DocumentUploader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const EmptyPersonal: Story = { args: { category: 'PERSONAL_IDENTITY', document: null } };

export const EmptyBusiness: Story = { args: { category: 'BUSINESS_IDENTITY', document: null } };

export const EmptyBusinessWithGstin: Story = {
  args: { category: 'BUSINESS_IDENTITY', document: null, gstin: GSTIN },
};

export const GstCertificateWithGstin: Story = {
  args: { category: 'BUSINESS_IDENTITY', document: document(), gstin: GSTIN },
};

export const GstinAlreadyRegistered: Story = {
  args: { category: 'BUSINESS_IDENTITY', document: null, gstin: GSTIN },
  render: (args) => (
    <RefusingCommit>
      <p style={{ fontSize: 12, marginBottom: 8 }}>
        Upload any PDF: the commit is refused with a 409 on the GSTIN.
      </p>
      <DocumentUploader {...args} />
    </RefusingCommit>
  ),
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

export const VerifiedLocked: Story = {
  args: {
    category: 'BUSINESS_IDENTITY',
    document: document({ status: 'VERIFIED', statusLabel: 'Verified' }),
    gstin: GSTIN,
    locked: true,
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
      <DocumentUploader category="BUSINESS_IDENTITY" document={document()} gstin={GSTIN} />
    </div>
  ),
};

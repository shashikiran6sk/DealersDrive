import type { DealerDocumentDto } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DocumentUploader } from '@/features/auth/document-uploader';

/**
 * DESIGN-SPEC §3.10 step 3 — one KYC document row (C041).
 *
 * **P0 in `component-sandbox.md`, and this is why**: the row has seven states,
 * five of them decided by the API and two by the browser, and until now none of
 * them could be seen without a real S3 bucket and a real rejection from a real
 * moderator. Every state below is a prop.
 *
 * The upload itself is presign → PUT straight to storage → commit. The file
 * never passes through the Next server; only the signing and commit calls are
 * proxied, because those need the session. There is no network here, so the
 * *uploading* and *failed* states are the two that stay out of reach — pressing
 * Upload in the sandbox opens a file picker and then fails at `fetch`, which is
 * honest rather than useful.
 *
 * KYC documents are private. There is no public delivery route for them at all
 * — an admin reads one through a short-lived signed URL, and every issue of one
 * is audit-logged (§26.6). That is why no story here shows a thumbnail.
 */
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

/**
 * Nothing uploaded. The sub-line carries the rules rather than the tag — a tag
 * is a state, not a sentence, and "Required — PDF or JPG, max 5 MB" would push
 * the row over its width.
 */
export const Required: Story = { args: { document: document() } };

/** Uploaded, waiting on a moderator. The action becomes Replace, not Upload. */
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

/** Verified. The type prefix in the tile is replaced by a tick. */
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

/**
 * Rejected, with the reason in place of the file name.
 *
 * This is the state that justifies the whole row rendering its own sub-line: a
 * dealer who reads `REJECTED` learns nothing, and a dealer who reads "Too
 * blurry to read" knows exactly what to send next.
 */
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

/** A presign was issued and the PUT has not been confirmed yet. */
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

/**
 * The whole checklist, which is how a dealer actually meets it — and the only
 * way to see that a long rejection reason truncates rather than reflows the
 * row.
 */
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

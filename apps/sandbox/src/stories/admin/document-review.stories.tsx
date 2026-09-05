import type { AdminDealerDetail } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DocumentReview } from '@/features/admin/document-review';

import { adminActionStub } from '../../mocks/admin-actions';

/**
 * D5 (C062b) — the KYC checklist with a verdict on each row.
 *
 * **Why this component exists at all.** `POST /admin/documents/:id/verify` and
 * its reject twin landed with F044 and nothing in the console called them.
 * That was not merely a missing pair of buttons: approving a dealership
 * requires all three documents `VERIFIED`, so with no way to verify one the
 * approve control could never appear — the console had a dead end shaped like
 * a missing feature. This is the half that closes it, and
 * `DealerAdminActions` is the other.
 *
 * Two things to check by eye:
 *
 *   · **Only an `UPLOADED` row is decidable.** `REQUIRED` has no file behind
 *     it, and a row already decided is re-decided by the dealer re-uploading
 *     rather than by a moderator changing their mind in place. So the stories
 *     below differ by `status` and the controls follow, the same way they do
 *     against the real API.
 *   · **A rejection reason is mandatory and has to have substance.** The
 *     dealer reads it verbatim and re-uploads against it, so "no" costs a
 *     support call. Press Reject and type: the destructive button stays
 *     disabled under six characters, which is the client half of what
 *     `ReasonInput` enforces on the server.
 *
 * `viewUrl` is a short-lived signed URL and is the only way a KYC document is
 * ever read — every issue of one is audit-logged (§26.6). The stories carry a
 * placeholder so the View link is visible; there is nothing behind it.
 *
 * The Server Actions are stubbed — `src/mocks/admin-actions.ts`, coupling C-4.
 */
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
  args: { documents: [document()] },
} satisfies Meta<typeof DocumentReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * The queue as a moderator finds it: three uploaded documents, none decided.
 * This is the state the approve control on the dealer card is waiting on.
 */
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

/**
 * A mixed checklist, which is what most dealerships look like partway through:
 * one verified, one rejected with the reason the dealer is reading, and one
 * still to upload. Only the last-but-one row offers a decision — and the
 * `REQUIRED` row has no View link either, because there is no file to sign.
 */
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

/** Every document verified — no controls left, which is the point of the state. */
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

/** Nothing uploaded at all. A sentence, not an empty box. */
export const Empty: Story = { args: { documents: [] } };

/**
 * The decision in flight. The stub holds for eight seconds so the loading
 * button is visible — press Verify.
 */
export const Deciding: Story = {
  decorators: [
    (Story) => {
      adminActionStub.delayMs = 8_000;
      adminActionStub.result = { ok: true };
      return <Story />;
    },
  ],
};

/**
 * The API refused. The message is the one the API sent rather than a generic
 * one: an admin told "that did not work" cannot tell a permissions problem
 * from a stale page. It sits above the list, because it belongs to the
 * checklist rather than to one row.
 */
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

import { ListingLifecycleAction, type DealerListing } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { listingLifecycleActionStub } from '../../mocks/listing-lifecycle-actions';

import {
  ListingLifecycleActions,
  ListingLifecyclePanel,
} from '@/features/dealer/listing-lifecycle';

const ID = '11111111-1111-4111-8111-111111111111';
const TITLE = '2023 Hyundai Creta SX(O)';

const meta = {
  title: 'Dealer/ListingLifecycleActions',
  component: ListingLifecycleActions,
  parameters: { layout: 'padded' },
  argTypes: {
    actions: { control: 'check', options: ListingLifecycleAction.options },
    size: { control: 'inline-radio', options: ['default', 'sm'] },
    reactivationPending: { control: 'boolean' },
  },
  args: {
    vehicleId: ID,
    vehicleTitle: TITLE,
    actions: ['reserve', 'markSold', 'withdraw'],
    reactivationPending: false,
    size: 'default',
  },
  beforeEach: () => {
    listingLifecycleActionStub.result = { ok: true };
    listingLifecycleActionStub.calls = [];
  },
} satisfies Meta<typeof ListingLifecycleActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {};

export const Reserved: Story = { args: { actions: ['markSold', 'requestReactivation'] } };

export const ReservedReactivationPending: Story = {
  args: { actions: ['markSold'], reactivationPending: true },
};

export const Withdrawn: Story = { args: { actions: ['requestReactivation'] } };

export const WithdrawnReactivationPending: Story = {
  args: { actions: [], reactivationPending: true },
};

export const SoldOffersNothing: Story = { args: { actions: [] } };

export const InATableRow: Story = { args: { size: 'sm' } };

export const MoveRefused: Story = {
  beforeEach: () => {
    listingLifecycleActionStub.result = {
      ok: false,
      message: 'This listing changed while you were looking at it. Reload it and try again.',
    };
  },
};

const LISTING: DealerListing = {
  id: '33333333-3333-4333-8333-333333333333',
  status: 'WITHDRAWN',
  statusLabel: 'Withdrawn',
  statusTone: 'neutral',
  reason: null,
  submittedAt: '2026-09-10T10:00:00.000Z',
  publishedAt: '2026-09-12T10:00:00.000Z',
  slug: '2023-hyundai-creta-sx-o-katpadi-1a2b3c4d',
  reservedAt: null,
  soldAt: null,
  withdrawnAt: '2026-09-20T10:00:00.000Z',
  withdrawal: {
    reason: 'DOCUMENT_ISSUE',
    reasonLabel: 'Issue with the documents',
    note: 'RC transfer is with the bank.',
  },
  canEdit: false,
  canSubmit: false,
  canDelete: false,
  actions: ['requestReactivation'],
  reactivation: null,
};

export const PanelWithdrawn: Story = {
  render: () => <ListingLifecyclePanel vehicleId={ID} vehicleTitle={TITLE} listing={LISTING} />,
};

export const PanelReactivationDeclined: Story = {
  render: () => (
    <ListingLifecyclePanel
      vehicleId={ID}
      vehicleTitle={TITLE}
      listing={{
        ...LISTING,
        reactivation: {
          id: '44444444-4444-4444-8444-444444444444',
          status: 'REJECTED',
          statusLabel: 'Reactivation declined',
          statusTone: 'err',
          fromStatus: 'WITHDRAWN',
          reason: 'Documents are back.',
          requestedAt: '2026-09-28T10:00:00.000Z',
          reviewedAt: '2026-09-29T10:00:00.000Z',
          adminNote: 'The RC transfer is still pending with the bank.',
        },
      }}
    />
  ),
};

export const PanelReactivationPending: Story = {
  render: () => (
    <ListingLifecyclePanel
      vehicleId={ID}
      vehicleTitle={TITLE}
      listing={{
        ...LISTING,
        actions: [],
        reactivation: {
          id: '44444444-4444-4444-8444-444444444444',
          status: 'PENDING',
          statusLabel: 'Reactivation pending approval',
          statusTone: 'warn',
          fromStatus: 'WITHDRAWN',
          reason: null,
          requestedAt: '2026-09-28T10:00:00.000Z',
          reviewedAt: null,
          adminNote: null,
        },
      }}
    />
  ),
};

export const PanelLive: Story = {
  render: () => (
    <ListingLifecyclePanel
      vehicleId={ID}
      vehicleTitle={TITLE}
      listing={{
        ...LISTING,
        status: 'ACTIVE',
        statusLabel: 'Active',
        statusTone: 'ok',
        withdrawnAt: null,
        withdrawal: null,
        actions: ['reserve', 'markSold', 'withdraw'],
      }}
    />
  ),
};

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };

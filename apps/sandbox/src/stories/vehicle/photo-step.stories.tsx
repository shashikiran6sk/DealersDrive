import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import {
  BulkUploadRow,
  PhotoPlanChoice,
  PhotoStep,
  UploadModeSwitch,
  planOptions,
} from '@/features/vehicle/photo-step';

import { mockPhotos, mockUnsorted } from '../../mocks/dealer-photos';
import { mockBilling } from '../../mocks/listing-credits';

const meta = {
  title: 'Vehicle/PhotoStep',
  component: PhotoStep,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: { photos: { control: 'object' }, billing: { control: 'object' } },
  args: {
    vehicleId: '22222222-2222-4222-8222-222222222222',
    photos: mockPhotos(),
    billing: mockBilling(),
    backHref: '#pricing',
    nextHref: '#review',
  },
} satisfies Meta<typeof PhotoStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoPlanYet: Story = {};

export const DealerAllAtOnce: Story = { args: { photos: mockPhotos({ plan: 'DEALER' }, 0) } };

export const AllAtOnceUploading: Story = {
  args: {
    photos: mockPhotos({ plan: 'DEALER', unsorted: mockUnsorted(6) }, 0),
  },
};

export const AllAtOnceReady: Story = {
  args: {
    photos: mockPhotos({ plan: 'DEALER', unsorted: mockUnsorted(12), missing: [], ready: true }, 0),
  },
};

export const UploadRows: Story = {
  render: () => (
    <ul className="card flex flex-col divide-y divide-(--color-divider) px-[16px]">
      <BulkUploadRow name="IMG_20261115_100012.jpg" status="uploaded" onRemove={() => undefined} />
      <BulkUploadRow name="IMG_20261115_100112.jpg" status="uploading" />
      <BulkUploadRow name="IMG_20261115_100212.jpg" status="waiting" />
      <BulkUploadRow
        name="IMG_20261115_100312.jpg"
        status="failed"
        message="The upload was rejected by storage."
        onRemove={() => undefined}
      />
    </ul>
  ),
};

export const ModeSwitch: Story = {
  render: () => <UploadModeSwitch mode="all" onChange={() => undefined} />,
};

export const DealerUploading: Story = { args: { photos: mockPhotos({ plan: 'DEALER' }, 4) } };

export const DealerComplete: Story = { args: { photos: mockPhotos({ plan: 'DEALER' }, 10) } };

export const DealersDrivePhotoshoot: Story = {
  args: { photos: mockPhotos({ plan: 'DEALERS_DRIVE', ready: true }) },
};

export const PhotoshootUnavailable: Story = {
  args: { photos: mockPhotos({ photoshoot: { available: false, district: 'Krishnagiri' } }) },
};

export const CreditsOff: Story = { args: { billing: mockBilling({ enabled: false }) } };

export const Locked: Story = {
  args: { photos: mockPhotos({ plan: 'DEALER', canEdit: false }, 10) },
};

export const PlanChoiceOnly: Story = {
  render: () => (
    <PhotoPlanChoice
      options={planOptions(mockPhotos(), mockBilling())}
      selected="DEALER"
      creditPrice="₹500"
      onChoose={() => undefined}
    />
  ),
};

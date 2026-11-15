import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import {
  BulkArrangement,
  EMPTY_ARRANGEMENT,
  PhotoPlanChoice,
  PhotoStep,
  UploadModeSwitch,
  arrange,
  planOptions,
  type LocalPhoto,
} from '@/features/vehicle/photo-step';

import { mockPhotos } from '../../mocks/dealer-photos';

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
  argTypes: { photos: { control: 'object' } },
  args: {
    vehicleId: '22222222-2222-4222-8222-222222222222',
    photos: mockPhotos(),
    backHref: '#pricing',
    nextHref: '#review',
  },
} satisfies Meta<typeof PhotoStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoPlanYet: Story = {};

export const DealerAllAtOnce: Story = { args: { photos: mockPhotos({ plan: 'DEALER' }, 0) } };

function guidePhoto(number: number): LocalPhoto {
  const padded = String(number).padStart(2, '0');
  return {
    id: `local-${padded}`,
    file: new File([], `IMG_${padded}.jpg`, { type: 'image/jpeg' }),
    previewUrl: `/photo-guide/shot-${padded}-result.webp`,
  };
}

const twelve = [2, 1, 3, 4, 5, 6, 7, 8, 9, 10, 4, 7].map((number, index) =>
  index >= 10 ? { ...guidePhoto(number), id: `extra-${String(index)}` } : guidePhoto(number),
);

export const BulkCheckTheOrder: Story = {
  render: () => (
    <div className="card p-[16px]">
      <BulkArrangement
        arrangement={arrange(EMPTY_ARRANGEMENT, twelve, new Set(), 6).arrangement}
        photos={mockPhotos({ plan: 'DEALER' }, 0)}
        selected={{ area: 'slot', index: 0 }}
        failed={new Set(['local-09'])}
        disabled={false}
        onPress={() => undefined}
        onRemove={() => undefined}
      />
    </div>
  ),
};

export const BulkAddingToUploaded: Story = {
  render: () => (
    <div className="card p-[16px]">
      <BulkArrangement
        arrangement={
          arrange(
            EMPTY_ARRANGEMENT,
            [guidePhoto(7), guidePhoto(8)],
            new Set([
              'FRONT_THREE_QUARTER_RIGHT',
              'FRONT',
              'FRONT_THREE_QUARTER_LEFT',
              'LEFT_SIDE',
              'REAR',
              'RIGHT_SIDE',
            ] as const),
            6,
          ).arrangement
        }
        photos={mockPhotos({ plan: 'DEALER' }, 6)}
        selected={null}
        failed={new Set()}
        disabled={false}
        onPress={() => undefined}
        onRemove={() => undefined}
      />
    </div>
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

export const Locked: Story = {
  args: { photos: mockPhotos({ plan: 'DEALER', canEdit: false }, 10) },
};

export const PlanChoiceOnly: Story = {
  render: () => (
    <PhotoPlanChoice
      options={planOptions(mockPhotos())}
      selected="DEALER"
      onChoose={() => undefined}
    />
  ),
};

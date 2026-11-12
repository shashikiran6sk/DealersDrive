import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { PhotoPlanChoice, PhotoStep, planOptions } from '@/features/vehicle/photo-step';

import { mockPhotos } from '../../mocks/dealer-photos';
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

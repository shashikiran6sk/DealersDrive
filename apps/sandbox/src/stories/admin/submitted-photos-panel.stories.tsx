import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { STANDARD_PHOTO_SLOTS } from '@dealers-drive/contracts';

import { SubmittedPhotosPanel } from '@/features/admin/listing-review/submitted-photos-panel';

import { mockSubmitted } from '../../mocks/photos-and-credits';

const meta = {
  title: 'Admin/SubmittedPhotosPanel',
  component: SubmittedPhotosPanel,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480, margin: '24px auto' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: { photos: { control: 'object' } },
  args: { listingId: '11111111-1111-4111-8111-111111111111', photos: mockSubmitted() },
} satisfies Meta<typeof SubmittedPhotosPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DealerSet: Story = {};

export const IncompleteSet: Story = {
  args: {
    photos: mockSubmitted({
      items: mockSubmitted().items.slice(0, 7),
      missing: STANDARD_PHOTO_SLOTS.slice(7),
    }),
  },
};

export const DealersDrivePhotoshoot: Story = {
  args: {
    photos: {
      plan: 'DEALERS_DRIVE',
      planLabel: 'Dealers-Drive photoshoot',
      items: [],
      missing: [],
    },
  },
};

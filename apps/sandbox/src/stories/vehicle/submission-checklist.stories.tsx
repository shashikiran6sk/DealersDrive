import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SubmissionChecklist } from '@/features/vehicle/vehicle-wizard/submission-checklist';

import { mockPhotos } from '../../mocks/dealer-photos';

const meta = {
  title: 'Vehicle/SubmissionChecklist',
  component: SubmissionChecklist,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  argTypes: { needs: { control: 'object' } },
  args: {
    needs: { photosShown: true, photosReady: true },
    photos: mockPhotos({ plan: 'DEALER', ready: true }, 10),
    photosHref: '#photos',
  },
} satisfies Meta<typeof SubmissionChecklist>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const PhotosMissing: Story = {
  args: {
    needs: { photosShown: true, photosReady: false },
    photos: mockPhotos({ plan: 'DEALER' }, 6),
  },
};

export const DealersDrivePhotoshoot: Story = {
  args: { photos: mockPhotos({ plan: 'DEALERS_DRIVE', ready: true }) },
};

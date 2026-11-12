import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SubmissionChecklist } from '@/features/vehicle/vehicle-wizard/submission-checklist';

import { MOCK_PACKS, mockBilling, mockPhotos } from '../../mocks/photos-and-credits';

const READY = {
  photosShown: true,
  photosReady: true,
  creditsShown: true,
  creditsNeeded: 1,
  creditsAvailable: 5,
  creditsReady: true,
};

const meta = {
  title: 'Vehicle/SubmissionChecklist',
  component: SubmissionChecklist,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  argTypes: { needs: { control: 'object' } },
  args: {
    needs: READY,
    photos: mockPhotos({ plan: 'DEALER', ready: true }, 10),
    billing: mockBilling(),
    packs: MOCK_PACKS,
    photosHref: '#photos',
  },
} satisfies Meta<typeof SubmissionChecklist>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const PhotosMissing: Story = {
  args: { needs: { ...READY, photosReady: false }, photos: mockPhotos({ plan: 'DEALER' }, 6) },
};

export const ShortOfCredits: Story = {
  args: {
    needs: { ...READY, creditsNeeded: 2, creditsAvailable: 0, creditsReady: false },
    billing: mockBilling({ balance: 0, held: 0, available: 0 }),
  },
};

export const ResubmissionAlreadyPaid: Story = { args: { needs: { ...READY, creditsNeeded: 0 } } };

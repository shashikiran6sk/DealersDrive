import type { DealerOnboardingProvenance } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { OnboardingProvenance } from '@/features/admin/onboarding-provenance';

const ASSISTED: DealerOnboardingProvenance = {
  source: 'ASSISTED',
  sourceLabel: 'Assisted by Sales',
  assistedBy: { name: 'Arun Field Sales', email: 'arun.sales@dealers-drive.in' },
  phoneVerified: true,
  phoneLabel: 'Verified',
  emailVerified: false,
  emailLabel: 'Pending verification',
  claimed: false,
  reviewerIsAssistant: false,
};

const meta = {
  title: 'Admin/OnboardingProvenance',
  component: OnboardingProvenance,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[720px] p-[20px]">
        <Story />
      </div>
    ),
  ],
  args: { onboarding: ASSISTED },
  argTypes: { onboarding: { control: 'object' } },
} satisfies Meta<typeof OnboardingProvenance>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Assisted: Story = { name: 'Assisted, email pending' };

export const ReviewerAssisted: Story = {
  name: 'The reviewer is the assistant',
  args: { onboarding: { ...ASSISTED, reviewerIsAssistant: true } },
};

export const SelfOnboarded: Story = {
  name: 'Self-onboarded',
  args: {
    onboarding: {
      ...ASSISTED,
      source: 'SELF',
      sourceLabel: 'Self-onboarded',
      assistedBy: null,
      emailVerified: true,
      emailLabel: 'Verified',
      claimed: true,
    },
  },
};

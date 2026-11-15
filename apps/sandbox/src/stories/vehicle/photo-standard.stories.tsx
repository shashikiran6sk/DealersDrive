import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import {
  BeforeYouShoot,
  GuideWalkround,
  PhotoStandardGuide,
  QuickReference,
  SHOT_GUIDES,
  ShotGuideCard,
} from '@/components/vehicle/photo-standard';

const meta = {
  title: 'Vehicle/PhotoStandardGuide',
  component: PhotoStandardGuide,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhotoStandardGuide>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullGuide: Story = {};

export const Walkround: Story = { render: () => <GuideWalkround /> };

export const BeforeYouShootAndPoses: Story = { render: () => <BeforeYouShoot /> };

export const ExteriorShot: Story = {
  render: () => <ShotGuideCard shot={SHOT_GUIDES[0] ?? SHOT_GUIDES[1]!} />,
};

export const InteriorShot: Story = {
  render: () => <ShotGuideCard shot={SHOT_GUIDES[6] ?? SHOT_GUIDES[0]!} />,
};

export const QuickReferenceCard: Story = { render: () => <QuickReference /> };

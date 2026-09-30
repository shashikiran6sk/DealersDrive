import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AudienceSection } from '@/features/home/audience-section';
import { JourneySection } from '@/features/home/journey-section';
import { TrustSection } from '@/features/home/trust-section';

const meta = {
  title: 'Home/InformationSections',
  component: JourneySection,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof JourneySection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Journey: Story = {};

export const Trust: Story = { render: () => <TrustSection /> };

export const Audience: Story = { render: () => <AudienceSection /> };

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => (
    <>
      <JourneySection />
      <TrustSection />
      <AudienceSection />
    </>
  ),
};

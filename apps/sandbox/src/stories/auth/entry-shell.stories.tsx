import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AuthHeading, AuthShell } from '@/components/auth/auth-shell';
import { EntryShell, EntryStory } from '@/components/auth/entry-shell';

const meta = {
  title: 'Auth/EntryShell',
  component: EntryShell,
  parameters: { layout: 'fullscreen' },
  args: {
    children: (
      <AuthShell eyebrow="Dealers-Drive">
        <AuthHeading title="Customer login">
          Sign in with your mobile number to contact dealers. No password, no email.
        </AuthHeading>
      </AuthShell>
    ),
  },
} satisfies Meta<typeof EntryShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PhoneWidth: Story = {
  parameters: { viewport: { defaultViewport: 'mobile' } },
};

export const StoryPanel: StoryObj<typeof EntryStory> = {
  render: () => (
    <div className="max-w-[720px]">
      <EntryStory />
    </div>
  ),
};

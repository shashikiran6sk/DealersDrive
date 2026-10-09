import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ConsoleUtilities } from '@/components/dealer/console-utilities';
const meta = {
  title: 'Dealer/ConsoleUtilities',
  component: ConsoleUtilities,
  args: { account: null },
  parameters: {
    layout: 'padded',
    nextjs: { appDirectory: true, navigation: { pathname: '/dealer' } },
  },
  decorators: [
    (Story) => (
      <div className="max-w-[280px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConsoleUtilities>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SignedOut: Story = {};
export const MultipleWorkspaces: Story = {
  args: {
    account: {
      fullName: 'Ramesh Kumar',
      phoneMasked: '+91 98XXXXXX45',
      invitations: 1,
      workspaces: [
        {
          membershipId: 'first',
          brandName: 'Sri Lakshmi Motors',
          roleLabel: 'Owner',
          current: true,
          enterable: true,
        },
        {
          membershipId: 'second',
          brandName: 'A very long dealership brand name for a second workspace',
          roleLabel: 'Staff',
          current: false,
          enterable: true,
        },
        {
          membershipId: 'closed',
          brandName: 'Suspended Motors',
          roleLabel: 'Owner',
          current: false,
          enterable: false,
        },
      ],
    },
  },
};

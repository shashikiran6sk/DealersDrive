import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { WebsiteActionForm } from '@/features/website/action-form';
import { WebsiteLink } from '@/features/website/website-link';
import type { WebsiteActionState } from '@/features/website/actions';

const meta = {
  title: 'Storefront/WebsiteSettings',
  component: WebsiteActionForm,
  parameters: { layout: 'padded' },
  args: {
    label: 'Save branding',
    action: (): Promise<WebsiteActionState> =>
      Promise.resolve({ status: 'saved', message: 'Sandbox save example.' }),
  },
  render: (args) => (
    <div className="card max-w-[650px] gap-5 p-6">
      <h1 className="text-[26px]">My Website</h1>
      <WebsiteLink url="https://synthetic.example.com" />
      <WebsiteActionForm {...args}>
        <label className="field">
          Website display name
          <input name="displayName" className="input" defaultValue="Synthetic Motors" />
        </label>
        <label className="field">
          Design
          <select name="theme" className="input">
            <option value="LIGHT">Light</option>
            <option value="DARK">Dark</option>
          </select>
        </label>
      </WebsiteActionForm>
    </div>
  ),
} satisfies Meta<typeof WebsiteActionForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const EditableOwner: Story = {};
export const ReadOnlyManager: Story = { args: { disabled: true } };
export const FailedSave: Story = {
  args: {
    action: () =>
      Promise.resolve({ status: 'error', message: 'Website infrastructure is not ready.' }),
  },
};

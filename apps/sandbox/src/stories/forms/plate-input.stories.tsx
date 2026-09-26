import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { PlateInput } from '@/components/forms/plate-input';

const meta = {
  title: 'Forms/PlateInput',
  component: PlateInput,
  parameters: { layout: 'padded' },
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    error: { control: 'text' },
    defaultValue: { control: 'text' },
    disabled: { control: 'boolean' },
    autoFocus: { control: 'boolean' },
  },
  args: { id: 'registrationNumber' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlateInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const StoredValue: Story = { args: { defaultValue: 'KA01AB1234' } };

export const BharatSeries: Story = { args: { defaultValue: '22BH1234AA' } };

export const ServerRefusal: Story = {
  args: {
    defaultValue: 'KA01AB1234',
    error: 'You already have a vehicle with this registration number.',
  },
};

export const Disabled: Story = { args: { defaultValue: 'TN09BX1234', disabled: true } };

export const Autofocus: Story = { args: { autoFocus: true } };

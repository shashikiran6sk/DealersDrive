import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { VehicleMakeSelect } from '@/components/forms/vehicle-make-select';

const meta = {
  title: 'Forms/VehicleMakeSelect',
  component: VehicleMakeSelect,
  parameters: { layout: 'padded' },
  argTypes: {
    defaultValue: { control: 'text' },
    placeholder: { control: 'text' },
    required: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: { id: 'make', placeholder: 'Search, e.g. Hyundai', required: true },
  render: (args) => (
    <div style={{ maxWidth: 360, minHeight: 320 }}>
      <label htmlFor={args.id} style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
        Make
      </label>
      <VehicleMakeSelect {...args} />
    </div>
  ),
} satisfies Meta<typeof VehicleMakeSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Selected: Story = { args: { defaultValue: 'Maruti Suzuki' } };

export const AliasResolvesToBrand: Story = { args: { defaultValue: 'MARUTI SUZUKI INDIA LTD' } };

export const SavedOutsideList: Story = { args: { defaultValue: 'Hindustan Ambassador Co' } };

export const Invalid: Story = {
  args: { 'aria-invalid': 'true', 'aria-describedby': 'make-error' },
};

export const Disabled: Story = { args: { defaultValue: 'Hyundai', disabled: true } };

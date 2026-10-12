import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ServiceLocationFields } from '@/components/forms/service-location-fields';

const meta = {
  title: 'Forms/ServiceLocationFields',
  component: ServiceLocationFields,
  parameters: { layout: 'padded' },
  argTypes: {
    initialState: { control: 'text' },
    initialDistrict: { control: 'text' },
    disabled: { control: 'boolean' },
  },
  args: { initialState: '', initialDistrict: '' },
  render: (args) => (
    <div style={{ maxWidth: 360, display: 'grid', gap: 16 }}>
      <ServiceLocationFields {...args} />
    </div>
  ),
} satisfies Meta<typeof ServiceLocationFields>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Selected: Story = { args: { initialState: 'Tamil Nadu', initialDistrict: 'Vellore' } };

export const ExistingLocationOutsideCatalogue: Story = {
  args: { initialState: 'Andhra Pradesh', initialDistrict: 'Kurnool' },
};

export const ServerRefusal: Story = {
  args: {
    initialState: 'Tamil Nadu',
    initialDistrict: '',
    errors: { district: 'This district is not available in the selected state.' },
  },
};

export const Disabled: Story = {
  args: { initialState: 'Tamil Nadu', initialDistrict: 'Chennai', disabled: true },
};

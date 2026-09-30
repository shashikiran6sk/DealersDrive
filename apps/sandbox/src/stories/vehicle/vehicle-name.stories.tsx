import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { VehicleName } from '@/components/vehicle/vehicle-name';

const meta = {
  title: 'Vehicle/VehicleName',
  component: VehicleName,
  parameters: { layout: 'padded' },
  args: { title: '2022 Maruti Suzuki Brezza ZXi', year: 2022 },
  render: (args) => (
    <h3 className="font-heading text-[14px] font-extrabold">
      <VehicleName {...args} />
    </h3>
  ),
} satisfies Meta<typeof VehicleName>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAYearPlateBeside: Story = {};

export const NoYear: Story = { args: { title: 'Maruti Suzuki Brezza ZXi', year: null } };

export const RegistrationOnly: Story = { args: { title: 'KA 01 AB 1234', year: 2022 } };

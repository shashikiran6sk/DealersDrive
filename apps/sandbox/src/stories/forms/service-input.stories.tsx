import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Field, invalidProps } from '@/components/forms/field';
import { ServiceInput } from '@/components/ui/service-input';

const meta = {
  title: 'Forms/ServiceInput',
  component: ServiceInput,
  parameters: { layout: 'padded' },
  argTypes: {
    value: { control: 'object' },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    max: { control: { type: 'number', min: 1, max: 24 } },
    maxLength: { control: { type: 'number', min: 8, max: 120 } },
  },
  args: {
    id: 'specialities',
    name: 'specialities',
    value: [],
    placeholder: 'In-house workshop',
  },
  decorators: [
    (Story) => (
      <form
        style={{ maxWidth: 520 }}
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <Story />
      </form>
    ),
  ],
} satisfies Meta<typeof ServiceInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const OneService: Story = { args: { value: ['In-house workshop'] } };

export const ThreeServices: Story = {
  args: { value: ['In-house workshop', 'RC transfer assistance', 'Bank loan tie-ups'] },
};

export const WrappingToTwoRows: Story = {
  args: {
    value: [
      'In-house workshop',
      'RC transfer assistance',
      'Bank loan tie-ups',
      'Insurance renewal',
      'Exchange',
      'Doorstep test drive',
    ],
  },
};

export const AtTheLimit: Story = {
  args: { value: Array.from({ length: 12 }, (_, index) => `Service ${String(index + 1)}`) },
};

export const WaitingForReview: Story = {
  args: { value: ['SUVs', 'Exchange', 'Bank loan tie-ups'], disabled: true },
};

export const Invalid: Story = {
  render: (args) => (
    <Field
      id="specialities"
      label="Services you offer"
      hint="one at a time, up to 12"
      error="Name at least one service you offer."
    >
      <ServiceInput
        {...args}
        {...invalidProps('specialities', 'Name at least one service you offer.')}
      />
    </Field>
  ),
  args: { value: [], required: true },
};

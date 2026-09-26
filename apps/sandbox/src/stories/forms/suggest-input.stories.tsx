import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Field } from '@/components/forms/field';
import { SuggestInput } from '@/components/forms/suggest-input';

const meta = {
  title: 'Forms/SuggestInput',
  component: SuggestInput,
  parameters: { layout: 'padded' },
  argTypes: {
    field: { control: 'select', options: ['make', 'model'] },
    defaultValue: { control: 'text' },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
  },
  args: { id: 'make', field: 'make', placeholder: 'Hyundai' },
  render: (args) => (
    <div style={{ maxWidth: 280 }}>
      <Field id={args.id} label="Make" hint="as on the RC">
        <SuggestInput {...args} />
      </Field>
    </div>
  ),
} satisfies Meta<typeof SuggestInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Prefilled: Story = { args: { defaultValue: 'Maruti Suzuki' } };

export const Model: Story = { args: { id: 'model', field: 'model', placeholder: 'Creta' } };

export const Disabled: Story = { args: { defaultValue: 'Tata', disabled: true } };

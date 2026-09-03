import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Input, Select, Textarea } from '@/components/ui/input';
import { Field, invalidProps } from '@/components/forms/field';

/**
 * `Field` is the accessibility contract every form in the product inherits:
 * label above, control, then an 11px error message wired to the control by
 * `aria-describedby` (DESIGN-SPEC §2.3).
 *
 * The error id is derived from the control id — `errorId(id)` — so no caller
 * has to invent a second convention, and `invalidProps(id, error)` returns the
 * three attributes an errored control needs or nothing at all.
 */
const meta = {
  title: 'Forms/Field',
  component: Field,
  parameters: { layout: 'padded' },
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    error: { control: 'text' },
  },
  args: { id: 'price', label: 'Asking price', children: null },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The four shapes: hint? × error?. */
export const Plain: Story = {
  render: (args) => (
    <Field {...args} id="a" label="Asking price">
      <Input id="a" placeholder="6,45,000" />
    </Field>
  ),
};

export const WithHint: Story = {
  render: (args) => (
    <Field {...args} id="b" label="Asking price" hint="in rupees">
      <Input id="b" placeholder="6,45,000" />
    </Field>
  ),
};

/**
 * The errored control carries `aria-invalid` and `aria-describedby` pointing
 * at the message — inspect the DOM here, not just the red border. Colour alone
 * is never the signal.
 */
export const WithError: Story = {
  render: (args) => (
    <Field {...args} id="c" label="Asking price" error="Enter a price above ₹10,000">
      <Input id="c" defaultValue="500" {...invalidProps('c', 'Enter a price above ₹10,000')} />
    </Field>
  ),
};

export const WithHintAndError: Story = {
  render: (args) => (
    <Field
      {...args}
      id="d"
      label="Asking price"
      hint="in rupees"
      error="Enter a price above ₹10,000"
    >
      <Input id="d" defaultValue="500" {...invalidProps('d', 'Enter a price above ₹10,000')} />
    </Field>
  ),
};

/**
 * Every control shape `.input` styles — `input`, `textarea.input` and
 * `select.input` are three separate rules in the stylesheet, which is why
 * there are three components rather than one.
 */
export const EveryControl: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: 16, maxWidth: 420 }}>
      <Field {...args} id="e1" label="Text">
        <Input id="e1" placeholder="TN 09 BX 1234" />
      </Field>
      <Field {...args} id="e2" label="Description">
        <Textarea id="e2" placeholder="Service history, ownership, anything a buyer should know" />
      </Field>
      <Field {...args} id="e3" label="Fuel type">
        <Select id="e3" defaultValue="petrol">
          <option value="petrol">Petrol</option>
          <option value="diesel">Diesel</option>
          <option value="cng">CNG</option>
        </Select>
      </Field>
      <Field {...args} id="e4" label="Disabled">
        <Input id="e4" defaultValue="Locked" disabled />
      </Field>
    </div>
  ),
};

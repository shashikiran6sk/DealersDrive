import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { OtpInput } from '@/components/ui/otp-input';

function Harness({
  invalid = false,
  disabled = false,
  initial = '',
}: {
  invalid?: boolean;
  disabled?: boolean;
  initial?: string;
}) {
  const [value, setValue] = useState(initial);

  return (
    <div className="flex flex-col gap-[12px] p-[24px]">
      <OtpInput id="otp" value={value} onChange={setValue} invalid={invalid} disabled={disabled} />
      <p className="text-[12px] ink-secondary">
        Value: <span className="tnum">{value || '—'}</span>
      </p>
    </div>
  );
}

const meta = {
  title: 'Forms/OtpInput',
  component: Harness,
  argTypes: {
    invalid: { control: 'boolean' },
    disabled: { control: 'boolean' },
    initial: { control: 'text' },
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = { args: {} };

export const PartlyTyped: Story = { args: { initial: '528' } };

export const Filled: Story = { args: { initial: '731904' } };

export const Invalid: Story = { args: { initial: '731904', invalid: true } };

export const Disabled: Story = { args: { initial: '731904', disabled: true } };

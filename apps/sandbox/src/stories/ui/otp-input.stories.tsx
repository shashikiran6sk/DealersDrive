import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { OtpInput } from '@/components/ui/otp-input';

/**
 * C075 — one box per digit (**R39**).
 *
 * DESIGN-SPEC §2.3: 52×58 cells, 22px tabular. A single `<input maxlength="6">`
 * would give the same behaviour for free and is the right control for most
 * products; the cells are what this design asks for, so the keyboard work is
 * paid for once, here.
 *
 * ── Three things to check by eye ────────────────────────────────────────────
 *
 *   · **Type.** Focus moves forward on each digit. Backspace on a filled box
 *     clears it; on an empty one it steps back and clears the one it lands on
 *     — one key either way, which is what somebody correcting a mistyped digit
 *     expects.
 *   · **Paste six digits into any box.** All six fill. This is not a nicety:
 *     `autocomplete="one-time-code"` sits on the *first* box, so a phone
 *     offering the code from the SMS fills that one with the whole code, and
 *     without this it would be crammed into a single cell.
 *   · **The invalid state.** Every box turns together, because the code is one
 *     value rather than six.
 */
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

/** What a refused code looks like: the digits stay, so they can be read back. */
export const Invalid: Story = { args: { initial: '731904', invalid: true } };

/** Every attempt spent — the only way on is a fresh code. */
export const Disabled: Story = { args: { initial: '731904', disabled: true } };

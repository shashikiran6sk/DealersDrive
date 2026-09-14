import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { OtpInput } from '@/components/ui/otp-input';

/**
 * C075 — the six-box code entry (**R39**).
 *
 * What is asserted here is the keyboard behaviour and nothing about the
 * layout, because the layout is the part that will be adjusted and the
 * behaviour is the part people notice only when it is missing: forward on a
 * digit, back on Backspace, and a pasted or autofilled code spread across all
 * six boxes rather than crammed into one.
 */
function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <OtpInput id="otp" value={value} onChange={setValue} />
      <output>{value}</output>
    </>
  );
}

function boxes(): HTMLInputElement[] {
  return screen.getAllByLabelText<HTMLInputElement>(/^Digit /);
}

describe('OtpInput', () => {
  it('renders one box per digit, labelled individually', () => {
    render(<Harness />);
    expect(boxes()).toHaveLength(6);
    expect(screen.getByRole('group', { name: 'Verification code' })).toBeInTheDocument();
  });

  it('moves forward as digits are typed', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(boxes()[0]!, '528');

    expect(screen.getByRole('status').textContent).toBe('528');
    expect(boxes()[3]).toHaveFocus();
  });

  it('ignores anything that is not a digit', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(boxes()[0]!, 'a1b2');

    expect(screen.getByRole('status').textContent).toBe('12');
  });

  /**
   * Backspace on a filled box clears it; on an empty one it steps back and
   * clears that. One key either way, which is what a person correcting a
   * mistyped digit expects.
   */
  it('steps back on Backspace and clears the digit it lands on', async () => {
    const user = userEvent.setup();
    render(<Harness initial="528" />);

    boxes()[3]!.focus();
    await user.keyboard('{Backspace}');

    expect(screen.getByRole('status').textContent).toBe('52');
    expect(boxes()[2]).toHaveFocus();
  });

  /**
   * The whole reason six inputs are survivable. `autocomplete="one-time-code"`
   * is on the first box, so a phone offering the code from the SMS fills that
   * one with all six digits — which must become six boxes, not one.
   */
  it('spreads a pasted code across every box', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(boxes()[0]!);
    await user.paste('731904');

    expect(screen.getByRole('status').textContent).toBe('731904');
    expect(boxes()[0]).toHaveAttribute('autocomplete', 'one-time-code');
  });

  it('never takes more digits than it has boxes', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(boxes()[0]!);
    await user.paste('12345678');

    expect(screen.getByRole('status').textContent).toBe('123456');
  });

  it('marks every box invalid together, because the code is one value', () => {
    render(<OtpInput id="otp" value="731904" onChange={() => undefined} invalid />);
    for (const box of boxes()) expect(box).toHaveAttribute('aria-invalid', 'true');
  });
});

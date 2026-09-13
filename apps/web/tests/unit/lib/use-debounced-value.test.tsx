import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedValue } from '@/lib/use-debounced-value';

/**
 * `src/lib/use-debounced-value.ts` (**R43**).
 *
 * The hook exists so a typeahead asks once per pause rather than once per
 * keystroke, and there are exactly three claims worth holding it to: it holds
 * the value back, it collapses a burst into one settle, and it lets go when
 * typing stops. Everything else in the box — aborting, dropping stale answers —
 * deliberately belongs elsewhere, and the last test here is what says so.
 */
function Harness({ delay = 300 }: { delay?: number }) {
  const [typed, setTyped] = useState('');
  const settled = useDebouncedValue(typed, delay);

  return (
    <>
      <input aria-label="typed" value={typed} onChange={(event) => setTyped(event.target.value)} />
      <output data-testid="settled">{settled}</output>
    </>
  );
}

function type(value: string): void {
  const input = screen.getByLabelText('typed');
  act(() => {
    // `userEvent` advances real time, which fake timers stop. The point of this
    // suite is the timer, so the change event is dispatched directly.
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(
      input,
      value,
    );
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function settled(): string {
  return screen.getByTestId('settled').textContent ?? '';
}

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('holds the value back until the delay has passed', () => {
    render(<Harness />);

    type('v');
    expect(settled()).toBe('');

    act(() => void vi.advanceTimersByTime(299));
    expect(settled()).toBe('');

    act(() => void vi.advanceTimersByTime(1));
    expect(settled()).toBe('v');
  });

  /** The whole reason it exists: "vellore" is one settle, not seven. */
  it('collapses a burst of changes into a single settle', () => {
    render(<Harness />);

    for (const value of ['v', 've', 'vel', 'vell', 'vello', 'vellor', 'vellore']) {
      type(value);
      act(() => void vi.advanceTimersByTime(100));
    }

    // 700 ms of typing, never a 300 ms gap: nothing has settled yet.
    expect(settled()).toBe('');

    act(() => void vi.advanceTimersByTime(300));
    expect(settled()).toBe('vellore');
  });

  it('settles again when typing resumes and stops', () => {
    render(<Harness />);

    type('vel');
    act(() => void vi.advanceTimersByTime(300));
    expect(settled()).toBe('vel');

    type('vellore');
    act(() => void vi.advanceTimersByTime(300));
    expect(settled()).toBe('vellore');
  });

  it('settles an emptied box, so clearing is not held forever', () => {
    render(<Harness />);

    type('vel');
    act(() => void vi.advanceTimersByTime(300));

    type('');
    act(() => void vi.advanceTimersByTime(300));
    expect(settled()).toBe('');
  });

  /**
   * A parent re-render that passes the same value must not restart the timer.
   * Without the equality check, a buyer typing steadily while anything else
   * re-renders around them would never see the request fire at all.
   */
  it('does not restart the timer when the value has not moved', () => {
    const { rerender } = render(<Harness />);

    type('vel');
    act(() => void vi.advanceTimersByTime(200));
    rerender(<Harness />);
    act(() => void vi.advanceTimersByTime(100));

    expect(settled()).toBe('vel');
  });
});

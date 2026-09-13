'use client';

import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

import { cn } from '@/lib/cn';

/**
 * DESIGN-SPEC §2.3 — one box per digit, 52×58, 22px tabular (**R39**).
 *
 * `'use client'` for the obvious reason: this is nothing but keyboard
 * behaviour. What that behaviour has to get right is the part people notice
 * only when it is missing —
 *
 *   · typing moves forward, Backspace on an empty box moves back and clears
 *     the one it lands on, so correcting a mistyped digit is one key;
 *   · pasting six digits into *any* box fills all six, because that is what
 *     the "copy code" affordance on both iOS and Android actually produces;
 *   · `autocomplete="one-time-code"` on the first box, which is what lets a
 *     phone offer the code from the SMS above the keyboard. Six separate
 *     inputs would ordinarily forfeit that — the attribute goes on the first
 *     one and the paste handler below turns the autofill into six digits.
 *
 * A single `<input maxlength="6">` would give all of that for free and is the
 * right control for most products. The cells are what the design asks for here,
 * so the cost is this file, paid once.
 *
 * The value is owned by the caller. This renders `value`, split — there is no
 * second copy of the code living in six pieces of DOM state that could
 * disagree with the one being submitted.
 */
export function OtpInput({
  id,
  value,
  onChange,
  length = 6,
  invalid = false,
  disabled = false,
  autoFocus = false,
  label = 'Verification code',
  onComplete,
}: {
  id: string;
  /** The digits typed so far, `''` to `length` characters. */
  value: string;
  onChange: (value: string) => void;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
  /** Fired once the last box is filled — the design's "verify as you finish". */
  onComplete?: (value: string) => void;
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  function focus(index: number): void {
    boxes.current[Math.min(Math.max(index, 0), length - 1)]?.focus();
  }

  function commit(next: string, caret: number): void {
    const cleaned = next.replace(/\D/g, '').slice(0, length);
    onChange(cleaned);
    focus(caret);
    if (cleaned.length === length) onComplete?.(cleaned);
  }

  function handleInput(index: number, typed: string): void {
    const digits = typed.replace(/\D/g, '');
    if (digits.length === 0) return;

    // More than one digit in one box means an autofill or a paste landed here.
    const next = (value.slice(0, index) + digits + value.slice(index + digits.length)).slice(
      0,
      length,
    );

    commit(next, index + digits.length);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Backspace') {
      event.preventDefault();
      // On a filled box, clear it. On an empty one, step back and clear that —
      // which is what a person who has just noticed the wrong digit expects.
      const target = value[index] ? index : index - 1;
      if (target < 0) return;
      commit(value.slice(0, target) + value.slice(target + 1), target);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focus(index - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focus(index + 1);
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>): void {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    event.preventDefault();
    commit((value.slice(0, index) + pasted).slice(0, length), index + pasted.length);
  }

  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap items-center gap-[10px] py-[4px]"
    >
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          id={index === 0 ? id : `${id}-${String(index)}`}
          ref={(element) => {
            boxes.current[index] = element;
          }}
          className={cn(
            'input tnum h-[58px] w-[52px] text-center text-[22px] font-semibold',
            invalid && 'text-(--color-err)',
          )}
          type="text"
          inputMode="numeric"
          // Only the first box carries it: a phone offering the code fills the
          // field it is on, and `handleInput` spreads the six digits from there.
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          value={value[index] ?? ''}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          aria-label={`Digit ${String(index + 1)} of ${String(length)}`}
          aria-invalid={invalid || undefined}
          onChange={(event) => {
            handleInput(index, event.target.value);
          }}
          onKeyDown={(event) => {
            handleKeyDown(index, event);
          }}
          onPaste={(event) => {
            handlePaste(index, event);
          }}
          onFocus={(event) => {
            event.target.select();
          }}
        />
      ))}
    </div>
  );
}

'use client';

import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

import { cn } from '@/lib/cn';

import { OTP_LENGTH, OTP_TEXT } from './otp-input.constants';
import type { OtpInputProps } from './otp-input.types';
import { clampIndex, digitsOnly } from './utils';

export function OtpInput({
  id,
  value,
  onChange,
  length = OTP_LENGTH,
  invalid = false,
  disabled = false,
  autoFocus = false,
  label = OTP_TEXT.groupLabel,
  onComplete,
}: OtpInputProps) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  function focus(index: number): void {
    boxes.current[clampIndex(index, length)]?.focus();
  }

  function commit(next: string, caret: number): void {
    const cleaned = digitsOnly(next).slice(0, length);
    onChange(cleaned);
    focus(caret);
    if (cleaned.length === length) onComplete?.(cleaned);
  }

  function handleInput(index: number, typed: string): void {
    const digits = digitsOnly(typed);
    if (digits.length === 0) return;

    const next = (value.slice(0, index) + digits + value.slice(index + digits.length)).slice(
      0,
      length,
    );

    commit(next, index + digits.length);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Backspace') {
      event.preventDefault();
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
    const pasted = digitsOnly(event.clipboardData.getData('text'));
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
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          value={value[index] ?? ''}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          aria-label={OTP_TEXT.digitLabel(index + 1, length)}
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

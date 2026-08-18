import { describe, expect, it } from 'vitest';

import { cn } from '../../../src/lib/cn.js';

/**
 * Tailwind-aware class joining. The point is not concatenation — `clsx` alone
 * does that — but conflict resolution: a component that ships `px-4` and a
 * caller that passes `px-8` must produce one padding, and it must be the
 * caller's. Plain joining leaves both classes and the winner is whichever
 * Tailwind emitted last, which is not something a caller can reason about.
 */

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values rather than rendering "undefined"', () => {
    expect(cn('a', undefined, null, false, '', 'b')).toBe('a b');
  });

  it('accepts a conditional object', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });

  it('flattens arrays', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c');
  });

  /** The reason this wraps twMerge at all. */
  it('lets the last conflicting utility win', () => {
    expect(cn('px-4', 'px-8')).toBe('px-8');
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
  });

  it('keeps utilities that do not conflict', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('resolves a conflict across the whole argument list, not just adjacent pairs', () => {
    expect(cn('px-2', 'py-1', 'px-6')).toBe('py-1 px-6');
  });

  /** The override case a component's `className` prop exists for. */
  it('lets a caller override a component default', () => {
    const componentDefault = 'rounded-md bg-slate-900 px-4 py-2';

    expect(cn(componentDefault, 'bg-red-600')).toContain('bg-red-600');
    expect(cn(componentDefault, 'bg-red-600')).not.toContain('bg-slate-900');
  });

  it('handles responsive and state variants separately from the base', () => {
    expect(cn('px-4', 'md:px-8')).toBe('px-4 md:px-8');
    expect(cn('hover:bg-red-500', 'hover:bg-blue-500')).toBe('hover:bg-blue-500');
  });

  it('returns an empty string for no input', () => {
    expect(cn()).toBe('');
    expect(cn(undefined)).toBe('');
  });
});

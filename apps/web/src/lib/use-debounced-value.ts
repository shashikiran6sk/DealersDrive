'use client';

import { useEffect, useState } from 'react';

/**
 * A value, held back until it stops changing (**R43**).
 *
 * ## Why the value and not the callback
 *
 * The usual shape of this is `useDebouncedCallback` — wrap the handler, call it
 * on every keystroke, let the wrapper decide. It is the wrong shape for React,
 * and the reason is closures: the wrapped function captures the render it was
 * created in, so the call that finally fires 300 ms later is holding whatever
 * state that render could see. The standard fix is a ref holding the latest
 * callback, which is a moving part in every consumer.
 *
 * Debouncing the *value* has no such problem. The consumer reads it in an
 * effect that lists it as a dependency, so the effect body is always the
 * current render's — and React's own rules about when that effect re-runs, and
 * when its cleanup fires, are the same rules as for any other dependency.
 *
 * ```tsx
 * const [typed, setTyped] = useState('');
 * const search = useDebouncedValue(typed, 300);
 * useEffect(() => { ... fetch(search) ... }, [search]);
 * ```
 *
 * ## What it does not do
 *
 * It does not cancel the request that the previous value started — an effect
 * cleanup and an `AbortController` do that, and they belong to the consumer
 * that owns the request. Debouncing is about *not asking*; aborting is about
 * having asked and changed your mind. `useAutocomplete` does both, and keeping
 * them separate is what makes each one legible.
 *
 * ## `delay` is read once per change, not captured
 *
 * It is in the dependency list, so changing it mid-flight restarts the timer
 * rather than letting a stale one fire. Nothing in the product changes it, but
 * a hook whose behaviour depends on a prop it ignores is a trap for whatever
 * does.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    /*
     * Nothing is scheduled when the value has not actually moved. Without this,
     * a parent re-render that happens to pass the same string restarts the
     * timer, and a buyer typing steadily while something else re-renders around
     * them would never see the request fire at all.
     */
    if (Object.is(value, settled)) return;

    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, settled, delay]);

  return settled;
}

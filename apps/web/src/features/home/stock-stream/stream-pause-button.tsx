'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';

import { STOCK_STREAM_TEXT } from './stock-stream.constants';
import type { StreamPauseButtonProps } from './stock-stream.types';

export function StreamPauseButton({
  className,
  label = STOCK_STREAM_TEXT.pause,
}: StreamPauseButtonProps) {
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    ref.current?.closest('[data-pausable]')?.toggleAttribute('data-paused', paused);
  }, [paused]);

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={paused}
      onClick={() => setPaused((value) => !value)}
      className={cn(
        'grid size-11 place-items-center rounded-full bg-white text-(--color-ink) shadow-md transition-colors duration-150 hover:bg-(--color-neutral-100) motion-reduce:hidden',
        className,
      )}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 fill-current">
        {paused ? <path d="M4 2.5v11l9.5-5.5z" /> : <path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" />}
      </svg>
    </button>
  );
}

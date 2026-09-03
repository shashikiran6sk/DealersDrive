import type { ReactNode } from 'react';

/**
 * DESIGN-SPEC §2.3 — label above, control, then an 11px `--err` message with
 * `margin-top:4px`.
 *
 * The error id is derived from the control id so callers can wire
 * `aria-describedby` to it without inventing a second convention.
 */
export function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `field ${className}` : 'field'}>
      <label htmlFor={id}>
        {label}
        {hint ? <span className="ml-1 ink-faint">{hint}</span> : null}
      </label>
      {children}
      {error ? (
        <div id={errorId(id)} className="mt-1 text-[11px] text-(--color-err)">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export function errorId(id: string): string {
  return `${id}-error`;
}

/** The three attributes an errored control needs, or nothing at all. */
export function invalidProps(
  id: string,
  error: string | undefined,
): { 'aria-invalid': 'true'; 'aria-describedby': string } | Record<string, never> {
  return error ? { 'aria-invalid': 'true', 'aria-describedby': errorId(id) } : {};
}

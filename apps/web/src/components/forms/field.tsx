import type { ReactNode } from 'react';

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

export function invalidProps(
  id: string,
  error: string | undefined,
): { 'aria-invalid': 'true'; 'aria-describedby': string } | Record<string, never> {
  return error ? { 'aria-invalid': 'true', 'aria-describedby': errorId(id) } : {};
}

import type { FieldProps } from './field.types';
import { errorId } from './utils';

export function Field({ id, label, hint, error, children, className }: FieldProps) {
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

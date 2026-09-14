import type { ButtonHTMLAttributes } from 'react';

import { buttonClass, type ButtonVariants } from './button.variants';
import { Spinner } from './spinner';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonVariants & {
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  block,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={buttonClass({ variant, size, block, className })}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

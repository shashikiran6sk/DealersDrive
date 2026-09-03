import { cva, type VariantProps } from 'class-variance-authority';
import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * DESIGN-SPEC §2.1 and §4.7.
 *
 * One `btn-primary` per view — the single forward action. `btn-secondary` for
 * alternate paths of equal weight, `btn-ghost` for navigation and low-stakes
 * affordances. Never a primary inside a table row, except the moderation
 * queue, where approving is the queue's whole purpose.
 */
const button = cva('btn', {
  variants: {
    variant: {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      ghost: 'btn-ghost',
      destructive: 'btn-destructive',
      danger: 'btn-danger-solid',
    },
    size: {
      /** Natural ≈32px: headers, toolbars. */
      default: '',
      /** In-card, table and chip actions. */
      sm: 'text-[12px] px-[10px] py-[4px]',
      /** VDP secondary pair, onboarding next. */
      md: 'h-10 text-[14px]',
      /** VDP primary CTA, auth submit, sheet CTA. */
      lg: 'h-11 text-[15px]',
      /** Hero search CTA. */
      hero: 'h-12 px-[26px] text-[15px]',
    },
    block: { true: 'btn-block', false: '' },
  },
  defaultVariants: { variant: 'secondary', size: 'default', block: false },
});

export type ButtonVariants = VariantProps<typeof button>;

export function buttonClass(variants: ButtonVariants & { className?: string }): string {
  const { className, ...rest } = variants;
  return cn(button(rest), className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonVariants & {
    /** Keeps width, swaps the label for a spinner, sets aria-busy (§2.1). */
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

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> &
  ButtonVariants & { href: string; children: ReactNode };

export function ButtonLink({
  className,
  variant,
  size,
  block,
  href,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link href={href} {...props} className={buttonClass({ variant, size, block, className })}>
      {children}
    </Link>
  );
}

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      className="animate-spin"
    >
      <circle cx="7" cy="7" r="5.5" opacity="0.25" />
      <path d="M12.5 7A5.5 5.5 0 0 0 7 1.5" strokeLinecap="round" />
    </svg>
  );
}

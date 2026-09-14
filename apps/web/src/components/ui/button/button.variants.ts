import { cva, type VariantProps } from 'class-variance-authority';

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

import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

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
      default: '',
      sm: 'text-[12px] px-[10px] py-[4px]',
      md: 'h-10 text-[14px]',
      lg: 'h-11 text-[15px]',
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

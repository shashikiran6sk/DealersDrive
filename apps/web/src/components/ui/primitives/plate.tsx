import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

const plate = cva('dd-plate', {
  variants: {
    size: {
      year: '',
      logo: 'h-[30px] min-w-[30px] justify-center rounded-[9px] border-(--color-accent) bg-(--color-accent) px-[6px] py-0 text-[12px] tracking-[-0.03em] text-white',
      chip: 'text-[10px]',
      marker: 'text-[9px]',
    },
  },
  defaultVariants: { size: 'year' },
});

export type PlateProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof plate>;

export function Plate({ className, size, children, ...props }: PlateProps) {
  return (
    <span className={cn(plate({ size }), className)} {...props}>
      {children}
    </span>
  );
}

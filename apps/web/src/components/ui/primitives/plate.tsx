import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

const plate = cva('dd-plate', {
  variants: {
    size: {
      year: '',
      logo: 'text-[12px] font-semibold py-[3px] pr-[9px]',
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

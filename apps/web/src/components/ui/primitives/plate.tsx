import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

const plate = cva('dd-plate', {
  variants: {
    size: {
      /** Year badge — the default. */
      year: '',
      /** Logo, in headers and sidebars. */
      logo: 'text-[12px] font-semibold py-[3px] pr-[9px]',
      /** Verified-dealer chip. */
      chip: 'text-[10px]',
      /** PRIMARY marker on the wizard's first photo tile. */
      marker: 'text-[9px]',
    },
  },
  defaultVariants: { size: 'year' },
});

export type PlateProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof plate>;

/**
 * The registration plate — the signature element, in exactly four places:
 * the logo, a vehicle card's year badge, the verified-dealer chip, and the
 * PRIMARY photo marker (DESIGN-SPEC §4.5). It is never interactive.
 */
export function Plate({ className, size, children, ...props }: PlateProps) {
  return (
    <span className={cn(plate({ size }), className)} {...props}>
      {children}
    </span>
  );
}

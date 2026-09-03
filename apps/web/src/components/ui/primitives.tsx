import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

/**
 * The primitives. Nothing in this file knows what a vehicle is — anything that
 * imports a domain type belongs in `components/vehicle/` instead, which is what
 * keeps `ui/` promotable to `packages/ui` later (ARCHITECTURE §16.4).
 *
 * ── Reconstruction note ─────────────────────────────────────────────────────
 * This file holds 14 primitives in the baseline and is built up across four
 * PRs, each adding the components it owns together with their CSS layer:
 *   F009  Plate                                            ← this PR
 *   F010  StatusTag, Tag, Banner
 *   F011  Blueprint, Corners, StatCard, ImageSlot, Avatar, LogoTile
 *   F012  EmptyState, ErrorState, SkeletonLines, Stepper
 * `StatusTone` is imported by F010, which is the first to need it.
 */
/**
 * The registration plate — the signature element, in exactly four places:
 * the logo, a vehicle card's year badge, the verified-dealer chip, and the
 * PRIMARY photo marker (DESIGN-SPEC §4.5). It is never interactive.
 */
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

export function Plate({
  className,
  size,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof plate>) {
  return (
    <span className={cn(plate({ size }), className)} {...props}>
      {children}
    </span>
  );
}

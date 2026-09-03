import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';
import type { StatusTone } from '@dealers-drive/contracts';

/**
 * The primitives. Nothing in this file knows what a vehicle is — anything that
 * imports a domain type belongs in `components/vehicle/` instead, which is what
 * keeps `ui/` promotable to `packages/ui` later (ARCHITECTURE §16.4).
 *
 * ── Reconstruction note ─────────────────────────────────────────────────────
 * This file holds 14 primitives in the baseline and is built up across four
 * PRs, each adding the components it owns together with their CSS layer:
 *   F009  Plate
 *   F010  StatusTag, Tag, Banner                            ← this PR
 *   F011  Blueprint, Corners, StatCard, ImageSlot, Avatar, LogoTile
 *   F012  EmptyState, ErrorState, SkeletonLines, Stepper
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

const TONE_CLASS: Record<StatusTone, string> = {
  ok: 'tag-ok',
  warn: 'tag-warn',
  err: 'tag-err',
  neutral: 'tag-neutral',
  accent: 'tag-accent',
};

/** Status is never conveyed by colour alone — the label always carries it (§4.15). */
export function StatusTag({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn('tag', TONE_CLASS[tone], className)}>{children}</span>;
}

export function Tag({
  variant = 'neutral',
  className,
  children,
}: {
  variant?: 'neutral' | 'accent' | 'outline';
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'tag',
        variant === 'accent' ? 'tag-accent' : variant === 'outline' ? 'tag-outline' : 'tag-neutral',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** DESIGN-SPEC §2.15 — cleared on navigation, never auto-dismissed. */
export function Banner({
  tone,
  title,
  children,
  action,
  className,
}: {
  tone: 'ok' | 'warn' | 'err';
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const styles = {
    ok: 'bg-(--color-ok-bg) text-(--color-ok) border-[color-mix(in_srgb,#0f7a5a_30%,transparent)]',
    warn: 'bg-(--color-warn-bg) text-(--color-warn) border-[color-mix(in_srgb,#a15c00_30%,transparent)]',
    err: 'bg-(--color-err-bg) text-(--color-err) border-[color-mix(in_srgb,#b3261e_30%,transparent)]',
  }[tone];

  return (
    <div className={cn('border px-[14px] py-[10px] text-[13px]', styles, className)} role="status">
      {title ? <div className="mb-[3px] text-[14px] font-semibold">{title}</div> : null}
      {children ? <div className="ink-body">{children}</div> : null}
      {action ? <div className="mt-[9px]">{action}</div> : null}
    </div>
  );
}

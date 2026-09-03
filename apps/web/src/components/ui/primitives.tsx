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
 *   F010  StatusTag, Tag, Banner
 *   F011  Blueprint, Corners, StatCard, ImageSlot, Avatar, LogoTile  ← this PR
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

/**
 * The blueprint frame. All four registration marks, always — a `.blueprint`
 * missing a corner is the one thing DESIGN-SPEC §4.4 calls out by name.
 *
 * Reserved for: the hero search block, hero and gallery figures, body-type
 * tiles, stat and balance cards, the price block, review-summary panels, the
 * under-review panel, and empty states. Not for plain content cards.
 */
export function Blueprint({
  className,
  children,
  as: Tag = 'div',
  ...props
}: HTMLAttributes<HTMLElement> & { as?: 'div' | 'section' | 'article' }) {
  return (
    <Tag className={cn('blueprint', className)} {...props}>
      <Corners />
      {children}
    </Tag>
  );
}

/**
 * The four registration marks on their own, for the places where the blueprint
 * frame has to be an element `Blueprint` cannot render — the gallery's main
 * image is a `<button>`. Anything carrying `.blueprint` must carry these.
 */
export function Corners() {
  return (
    <>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
    </>
  );
}

/**
 * Square avatars. `border-radius: 50%` appears nowhere in this product
 * (DESIGN-SPEC §4.3) — the monogram sits in a cobalt-tinted square.
 */
export function Avatar({
  initials,
  size = 20,
  className,
}: {
  initials: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid flex-none place-items-center bg-(--color-accent-200) font-bold text-(--color-accent-800)',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.42)) }}
    >
      {initials}
    </span>
  );
}

/** The larger logo tile variant, on a lighter tint with a hairline. */
export function LogoTile({
  initials,
  size = 42,
  className,
}: {
  initials: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid flex-none place-items-center border border-(--color-divider) bg-(--color-accent-100) font-heading font-bold text-(--color-accent-800)',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.3) }}
    >
      {initials}
    </span>
  );
}

/** DESIGN-SPEC §2.12 — blueprint, eyebrow, tabular stat, delta line. */
export function StatCard({
  label,
  value,
  delta,
  deltaTone = 'neutral',
  className,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: StatusTone;
  className?: string;
}) {
  const deltaColor =
    deltaTone === 'ok'
      ? 'text-(--color-ok)'
      : deltaTone === 'warn'
        ? 'text-(--color-warn)'
        : deltaTone === 'err'
          ? 'text-(--color-err)'
          : 'ink-subtle';

  return (
    <Blueprint className={cn('bg-white p-4', className)}>
      <div className="eyebrow">{label}</div>
      <div className="font-heading text-[34px] font-bold leading-[1.15] tnum">{value}</div>
      {delta ? <div className={cn('text-[12px]', deltaColor)}>{delta}</div> : null}
    </Blueprint>
  );
}

/** A placeholder panel naming the shot, exactly as the prototype renders one. */
export function ImageSlot({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn('image-slot', className)} role="img" aria-label={label}>
      <span>{label}</span>
    </div>
  );
}

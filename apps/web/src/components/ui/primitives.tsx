import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';
import type { StatusTone } from '@dealers-drive/contracts';

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

export function ImageSlot({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn('image-slot', className)} role="img" aria-label={label}>
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
  className,
}: {
  title: string;
  message: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Blueprint className={cn('bg-white px-6 py-14 text-center', className)}>
      <div className="font-heading text-[22px] font-semibold">{title}</div>
      <p className="mx-auto mt-[7px] max-w-[46ch] text-[14px] ink-muted">{message}</p>
      {action ? <div className="mt-[18px] flex justify-center gap-2">{action}</div> : null}
    </Blueprint>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <Blueprint className="bg-white px-6 py-14 text-center" role="alert">
      <div className="font-heading text-[22px] font-semibold text-(--color-err)">{title}</div>
      <p className="mx-auto mt-[7px] max-w-[46ch] text-[14px] ink-muted">{message}</p>
      {action ? <div className="mt-[18px] flex justify-center gap-2">{action}</div> : null}
    </Blueprint>
  );
}

export function SkeletonLines({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-[6px]', className)}>
      <div className="skeleton w-[70%]" />
      <div className="skeleton w-[46%]" />
      <div className="skeleton w-[88%]" />
    </div>
  );
}

export function Stepper({
  steps,
  current,
  className,
}: {
  steps: readonly string[];
  current: number;
  className?: string;
}) {
  return (
    <ol className={cn('flex gap-[6px]', className)}>
      {steps.map((label, index) => (
        <li key={label} className="flex-1">
          <div
            className="h-[3px]"
            style={{
              background: index <= current ? 'var(--color-accent)' : 'var(--color-neutral-300)',
            }}
          />
          <div
            className="mt-[7px] text-[11px]"
            style={{
              color:
                index <= current
                  ? 'var(--color-accent-700)'
                  : 'color-mix(in srgb, var(--color-ink) 45%, transparent)',
            }}
          >
            {label}
          </div>
        </li>
      ))}
    </ol>
  );
}

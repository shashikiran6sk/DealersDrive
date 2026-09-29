import { cn } from '@/lib/cn';

export interface LogoTileProps {
  initials: string;
  size?: number;
  className?: string;
}

export function LogoTile({ initials, size = 42, className }: LogoTileProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid flex-none place-items-center rounded-[10px] border border-(--color-divider) bg-(--color-neutral-100) font-heading font-extrabold text-(--color-ink)',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.3) }}
    >
      {initials}
    </span>
  );
}

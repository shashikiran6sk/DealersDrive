import { cn } from '@/lib/cn';

export interface AvatarProps {
  initials: string;
  size?: number;
  className?: string;
}

/**
 * Square avatars. `border-radius: 50%` appears nowhere in this product
 * (DESIGN-SPEC §4.3) — the monogram sits in a cobalt-tinted square.
 */
export function Avatar({ initials, size = 20, className }: AvatarProps) {
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

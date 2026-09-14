import { cn } from '@/lib/cn';

export interface ImageSlotProps {
  label: string;
  className?: string;
}

/** A placeholder panel naming the shot, exactly as the prototype renders one. */
export function ImageSlot({ label, className }: ImageSlotProps) {
  return (
    <div className={cn('image-slot', className)} role="img" aria-label={label}>
      <span>{label}</span>
    </div>
  );
}

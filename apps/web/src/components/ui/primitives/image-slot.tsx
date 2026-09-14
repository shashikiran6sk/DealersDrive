import { cn } from '@/lib/cn';

export interface ImageSlotProps {
  label: string;
  className?: string;
}

export function ImageSlot({ label, className }: ImageSlotProps) {
  return (
    <div className={cn('image-slot', className)} role="img" aria-label={label}>
      <span>{label}</span>
    </div>
  );
}

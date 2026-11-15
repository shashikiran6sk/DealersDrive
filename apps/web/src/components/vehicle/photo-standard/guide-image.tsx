import { cn } from '@/lib/cn';

export interface GuideImageProps {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}

export function GuideImage({ src, alt, className, eager = false }: GuideImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={cn(
        'block h-auto w-full rounded-[12px] bg-(--color-accent-100) object-cover',
        className,
      )}
    />
  );
}

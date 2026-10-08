import { cn } from '@/lib/cn';

import type { HeroBannerProps } from './hero-banner.types';

export function HeroBanner({ image, children }: HeroBannerProps) {
  return (
    <section
      data-slot="hero-banner"
      className="relative isolate border-b border-(--color-divider) bg-(--color-accent-900) text-white"
    >
      <div
        aria-hidden={image ? undefined : true}
        className="absolute inset-0 -z-10 overflow-hidden"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.src}
            alt={image.alt}
            fetchPriority="high"
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(120%_90%_at_85%_20%,#3a3a37_0%,#171716_45%,#0c0c0b_100%)]" />
        )}
        <div
          aria-hidden="true"
          className={cn(
            'absolute inset-0',
            image
              ? 'bg-black/55 md:bg-linear-to-r md:from-black/80 md:via-black/50 md:to-black/10'
              : 'bg-transparent',
          )}
        />
      </div>

      <div className="mx-auto flex min-h-[500px] max-w-[1440px] max-md:min-h-[380px] max-md:py-8 items-center px-4 py-12 sm:px-6 md:min-h-[560px] md:py-16 lg:px-10">
        <div className="w-full max-w-[640px] min-w-0">{children}</div>
      </div>
    </section>
  );
}

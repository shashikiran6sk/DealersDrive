import type { HeroBannerProps } from './hero-banner.types';
import { HeroPhoto } from './hero-photo';

export function HeroBanner({ image, aside, children }: HeroBannerProps) {
  return (
    <section
      data-slot="hero-banner"
      className="relative z-10 border-b border-(--color-divider) bg-white"
    >
      <div className="mx-auto grid max-w-[1440px] items-center gap-8 px-4 py-10 sm:px-6 md:py-12 lg:grid-cols-2 lg:gap-10 lg:px-10">
        <div className="min-w-0">{children}</div>
        <div className="min-w-0">{aside ?? <HeroPhoto image={image} />}</div>
      </div>
    </section>
  );
}

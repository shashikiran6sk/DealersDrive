import type { HeroPhotoProps } from './hero-banner.types';

export function HeroPhoto({ image }: HeroPhotoProps) {
  return (
    <div
      aria-hidden={image ? undefined : true}
      className="aspect-[4/3] overflow-hidden rounded-[28px] bg-[radial-gradient(120%_90%_at_85%_20%,#3a3a37_0%,#171716_45%,#0c0c0b_100%)] lg:aspect-auto lg:h-[600px]"
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.src}
          alt={image.alt}
          fetchPriority="high"
          className="h-full w-full object-cover object-center"
        />
      ) : null}
    </div>
  );
}

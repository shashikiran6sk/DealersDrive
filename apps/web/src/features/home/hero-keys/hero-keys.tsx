import { cn } from '@/lib/cn';

import { HERO_KEYS_IMAGE } from './hero-keys.constants';
import type { HeroKeysProps } from './hero-keys.types';

export function HeroKeys({ className }: HeroKeysProps) {
  return (
    <div
      data-slot="hero-keys"
      aria-hidden="true"
      className={cn(
        'flex h-[190px] max-w-[560px] items-end justify-center lg:h-[260px]',
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={HERO_KEYS_IMAGE.src}
        width={HERO_KEYS_IMAGE.width}
        height={HERO_KEYS_IMAGE.height}
        alt=""
        decoding="async"
        className="h-full w-auto max-w-full object-contain"
      />
    </div>
  );
}

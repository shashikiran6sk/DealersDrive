import type { PublicConfig } from '@dealers-drive/contracts';

import { HOME_HERO_IMAGE } from './hero-banner.constants';
import type { HeroImage } from './hero-banner.types';

export function heroImageFrom(configured: PublicConfig['heroImage'] | undefined): HeroImage {
  if (!configured) return HOME_HERO_IMAGE;
  return { src: configured.src, alt: configured.alt.trim() || HOME_HERO_IMAGE.alt };
}

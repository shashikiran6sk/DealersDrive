import { Img } from 'remotion';

import iconWhite from '../../../../web/public/brand/dd-icon-white.svg';
import wordmarkBlack from '../../../../web/public/brand/dealersdrive-wordmark-black.svg';
import wordmarkWhite from '../../../../web/public/brand/dealersdrive-wordmark-white.svg';

import { WORDMARK_RATIO } from './brand-mark.constants';

export type BrandMarkProps = {
  tone: 'white' | 'black';
  height: number;
};

export function BrandWordmark({ tone, height }: BrandMarkProps) {
  return (
    <Img
      src={tone === 'white' ? wordmarkWhite : wordmarkBlack}
      style={{ height, width: Math.round(height * WORDMARK_RATIO) }}
    />
  );
}

export const BRAND_ICON_WHITE = iconWhite;

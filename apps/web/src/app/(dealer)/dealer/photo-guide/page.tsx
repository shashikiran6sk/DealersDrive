import type { Metadata } from 'next';

import { PHOTO_STANDARD_TEXT, PhotoStandardGuide } from '@/components/vehicle/photo-standard';

export const metadata: Metadata = { title: PHOTO_STANDARD_TEXT.title };

export default function PhotoGuidePage() {
  return (
    <div className="flex max-w-[960px] flex-col gap-[18px] px-4 py-[22px] md:px-8 md:py-[30px]">
      <div>
        <h1 className="text-[25px] tracking-[-0.035em] md:text-[30px]">
          {PHOTO_STANDARD_TEXT.title}
        </h1>
        <p className="mt-1 max-w-[68ch] text-[13px] ink-muted">{PHOTO_STANDARD_TEXT.intro}</p>
      </div>
      <PhotoStandardGuide />
    </div>
  );
}

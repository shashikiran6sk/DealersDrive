import { cn } from '@/lib/cn';

import { DEALER_GALLERY_TEXT } from './dealer-gallery.constants';
import type { DealerGalleryProps } from './dealer-gallery.types';

export function DealerGallery({ photos, brandName, className }: DealerGalleryProps) {
  if (photos.length === 0) return null;

  return (
    <section
      id="photos"
      aria-labelledby="dealer-gallery-heading"
      className={cn('mx-auto max-w-[1280px] px-4 pt-6 sm:px-6', className)}
    >
      <h2 id="dealer-gallery-heading" className="eyebrow mb-[10px]">
        {DEALER_GALLERY_TEXT.heading}
      </h2>
      <ul
        aria-label={DEALER_GALLERY_TEXT.listLabel(brandName)}
        className="m-0 grid list-none gap-[12px] p-0 [grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr))]"
      >
        {photos.map((photo, index) => (
          <li key={photo.url}>
            <figure className="m-0 flex flex-col gap-[6px]">
              <div className="aspect-[4/3] overflow-hidden border border-(--color-divider) bg-(--color-surface)">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={DEALER_GALLERY_TEXT.photoAlt(brandName, index + 1, photo.caption)}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              {photo.caption ? (
                <figcaption className="text-[13px] ink-secondary [overflow-wrap:anywhere]">
                  {photo.caption}
                </figcaption>
              ) : null}
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

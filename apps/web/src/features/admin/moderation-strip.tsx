'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * DESIGN-SPEC §2.9 moderation variant — 92px thumbs, 26px arrows.
 *
 * Deliberately not the VDP gallery: a reviewer is checking the submitted set,
 * not browsing it, so there is no lightbox and clicking a thumb swaps the main
 * image in place.
 */
export function ModerationStrip({
  photos,
}: {
  photos: { id: string; position: number; label: string; url: string }[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setAtStart(track.scrollLeft <= 1);
    setAtEnd(track.scrollLeft + track.clientWidth >= track.scrollWidth - 1);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  return (
    <div className="relative mt-3 px-8">
      <button
        type="button"
        className="dd-arrow left-0 h-[26px] w-[26px]"
        disabled={atStart}
        onClick={() => trackRef.current?.scrollBy({ left: -240, behavior: 'smooth' })}
        aria-label="Scroll photos left"
      >
        ‹
      </button>

      <div ref={trackRef} className="dd-strip" onScroll={measure}>
        {photos.map((photo) => (
          <a
            key={photo.id}
            href={photo.url}
            target="_blank"
            rel="noreferrer noopener"
            className="relative aspect-[4/3] flex-[0_0_92px] overflow-hidden border border-(--color-divider) bg-(--color-surface)"
            aria-label={`Open full size: ${photo.label}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={photo.label} className="h-full w-full object-cover" />
          </a>
        ))}
      </div>

      <button
        type="button"
        className="dd-arrow right-0 h-[26px] w-[26px]"
        disabled={atEnd}
        onClick={() => trackRef.current?.scrollBy({ left: 240, behavior: 'smooth' })}
        aria-label="Scroll photos right"
      >
        ›
      </button>
    </div>
  );
}

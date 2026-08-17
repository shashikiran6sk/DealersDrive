'use client';

import type { VehiclePhoto } from '@dealers-drive/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Corners, ImageSlot } from '@/components/ui/primitives';

/**
 * DESIGN-SPEC §2.9 and §2.10 — the VDP gallery.
 *
 * One of the few genuine client islands on a public page (Rule 8): the strip
 * scrolls, the lightbox pages with the arrow keys and traps focus, and none of
 * that survives a server render. Everything around it stays a server component.
 */
export function VehicleGallery({
  photos,
  title,
  photoCountLabel,
}: {
  photos: VehiclePhoto[];
  title: string;
  photoCountLabel: string;
}) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  const mainRef = useRef<HTMLButtonElement>(null);
  const thumbRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  /** Which control opened the lightbox, so focus returns exactly there (§2.10). */
  const openerRef = useRef<HTMLElement | null>(null);

  const open = useCallback((index: number, opener: HTMLElement | null) => {
    openerRef.current = opener;
    setOpenAt(index);
  }, []);

  const close = useCallback(() => {
    setOpenAt(null);
    openerRef.current?.focus();
  }, []);

  const first = photos[0];

  return (
    <div>
      <button
        ref={mainRef}
        type="button"
        onClick={() => open(0, mainRef.current)}
        className="blueprint block aspect-[4/3] w-full cursor-zoom-in bg-(--color-surface) p-0"
        aria-label={
          photos.length > 0 ? `View all ${photos.length} photos of ${title}` : `Photos of ${title}`
        }
      >
        <Corners />
        {first ? (
          <PhotoImage photo={first} sizes="(max-width: 1024px) 100vw, 720px" priority />
        ) : (
          <ImageSlot label={`Main photo — ${title}`} />
        )}
        {photos.length > 0 ? (
          <span className="tag absolute bottom-[10px] right-[10px] z-[3] bg-white text-[11px]">
            {photoCountLabel}
          </span>
        ) : null}
      </button>

      {photos.length > 1 ? (
        <Strip
          photos={photos}
          onOpen={(index) => open(index, thumbRefs.current.get(index) ?? null)}
          register={(index, node) => {
            if (node) thumbRefs.current.set(index, node);
            else thumbRefs.current.delete(index);
          }}
        />
      ) : null}

      {openAt !== null ? (
        <Lightbox photos={photos} title={title} startAt={openAt} onClose={close} />
      ) : null}
    </div>
  );
}

/** The 108px thumbnail track. Arrows scroll ±240px and disable at either end. */
function Strip({
  photos,
  onOpen,
  register,
}: {
  photos: VehiclePhoto[];
  onOpen: (index: number) => void;
  register: (index: number, node: HTMLButtonElement | null) => void;
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

  function scroll(direction: -1 | 1) {
    trackRef.current?.scrollBy({ left: direction * 240, behavior: 'smooth' });
  }

  return (
    <div className="relative mt-[14px] px-[34px]">
      <button
        type="button"
        className="dd-arrow left-0"
        onClick={() => scroll(-1)}
        disabled={atStart}
        aria-label="Scroll photos left"
      >
        ‹
      </button>

      <div ref={trackRef} className="dd-strip" onScroll={measure}>
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            ref={(node) => register(index, node)}
            type="button"
            onClick={() => onOpen(index)}
            className="relative aspect-[4/3] flex-[0_0_108px] overflow-hidden border border-(--color-divider) bg-(--color-surface) p-0 max-[375px]:flex-[0_0_88px]"
            aria-label={`Open photo ${index + 1}: ${photo.label}`}
          >
            <PhotoImage photo={photo} sizes="108px" />
          </button>
        ))}
      </div>

      <button
        type="button"
        className="dd-arrow right-0"
        onClick={() => scroll(1)}
        disabled={atEnd}
        aria-label="Scroll photos right"
      >
        ›
      </button>
    </div>
  );
}

/**
 * The fullscreen lightbox. Esc closes, ←/→ page and wrap at both ends, focus is
 * trapped inside the overlay, and the active rail cell scrolls itself centred.
 */
function Lightbox({
  photos,
  title,
  startAt,
  onClose,
}: {
  photos: VehiclePhoto[];
  title: string;
  startAt: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startAt);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const activeCellRef = useRef<HTMLButtonElement>(null);

  const step = useCallback(
    (delta: number) => setIndex((current) => (current + delta + photos.length) % photos.length),
    [photos.length],
  );

  useEffect(() => {
    closeRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
        return;
      }
      if (event.key !== 'Tab') return;

      // Focus trap: the overlay covers the page, so Tab must not walk out into
      // the document behind it (§2.10, §4.15).
      const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (!firstEl || !lastEl) return;

      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, step]);

  useEffect(() => {
    activeCellRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [index]);

  const current = photos[index];

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — photo gallery`}
      className="fixed inset-0 z-[90] flex flex-col bg-[#0d1017]"
    >
      <header className="flex h-[54px] flex-none items-center gap-3 border-b border-white/15 px-4 text-white">
        <span className="border border-white/40 px-[7px] py-[2px] font-mono text-[11px]">DD</span>
        <div className="font-heading text-[15px] font-semibold">{title}</div>
        <div className="text-[12px] opacity-60 tnum">
          {index + 1} / {photos.length}
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="btn btn-secondary ml-auto border-white/35 bg-transparent text-white"
        >
          Close ✕
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="dd-rail w-[84px] flex-none border-r border-white/15 p-3 md:w-[132px]">
          {photos.map((photo, cell) => (
            <button
              key={photo.id}
              ref={cell === index ? activeCellRef : undefined}
              type="button"
              onClick={() => setIndex(cell)}
              aria-current={cell === index || undefined}
              aria-label={`Photo ${cell + 1}: ${photo.label}`}
              className="relative aspect-[4/3] w-full flex-none overflow-hidden border-2 bg-[#1a1f29] p-0"
              style={{ borderColor: cell === index ? 'var(--color-accent)' : 'transparent' }}
            >
              <PhotoImage photo={photo} sizes="132px" />
              <span className="absolute bottom-0 left-0 z-[3] bg-[rgba(13,16,23,0.75)] px-[5px] py-px font-mono text-[10px] text-white">
                {cell + 1}
              </span>
            </button>
          ))}
        </div>

        <div className="relative flex min-w-0 flex-1 items-center justify-center p-5">
          <button
            type="button"
            className="dd-arrow left-[14px] h-[38px] w-[38px] bg-white/90"
            onClick={() => step(-1)}
            aria-label="Previous photo"
          >
            ‹
          </button>

          <div className="aspect-[4/3] max-h-full w-[min(100%,1100px)] max-w-full border border-white/15 bg-[#151a23]">
            {current ? <PhotoImage photo={current} sizes="1100px" /> : null}
          </div>

          <button
            type="button"
            className="dd-arrow right-[14px] h-[38px] w-[38px] bg-white/90"
            onClick={() => step(1)}
            aria-label="Next photo"
          >
            ›
          </button>

          <div
            className="absolute inset-x-0 bottom-[14px] text-center text-[12px] text-white/70"
            aria-live="polite"
          >
            {current?.label}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The media pipeline already produced the derivatives and the srcset, so a
 * plain `<img>` beats `next/image` re-optimising bytes that are already optimal
 * (ARCHITECTURE §12.4).
 */
function PhotoImage({
  photo,
  sizes,
  priority = false,
}: {
  photo: VehiclePhoto;
  sizes: string;
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.url}
      srcSet={photo.srcset}
      sizes={sizes}
      alt={photo.label}
      {...(photo.width !== null ? { width: photo.width } : {})}
      {...(photo.height !== null ? { height: photo.height } : {})}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      className="h-full w-full object-cover"
    />
  );
}

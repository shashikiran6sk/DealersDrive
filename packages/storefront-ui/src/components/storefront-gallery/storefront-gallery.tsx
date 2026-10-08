'use client';

import type { PublicVehicleDetail } from '@dealers-drive/contracts';
import { useRef, useState } from 'react';

import { StorefrontImage } from '../storefront-image/storefront-image';

export function StorefrontGallery({
  images,
  title,
  primaryIndex = 0,
}: {
  images: PublicVehicleDetail['images'];
  title: string;
  primaryIndex?: number;
}) {
  const [selected, setSelected] = useState(Math.max(0, Math.min(primaryIndex, images.length - 1)));
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = images[selected];
  return (
    <div className="wl-gallery">
      <button
        className="wl-gallery-main"
        type="button"
        ref={trigger}
        disabled={!current}
        aria-label="View vehicle photograph fullscreen"
        onClick={() => dialog.current?.showModal()}
      >
        <StorefrontImage
          src={current?.url ?? null}
          alt={current?.alt ?? `${title} photograph unavailable`}
          priority
        />
        {current ? <span>View fullscreen ↗</span> : null}
      </button>
      {images.length > 1 ? (
        <div className="wl-thumbnails" aria-label="Vehicle photographs">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              aria-label={`Show photograph ${index + 1}`}
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
            >
              <StorefrontImage src={image.url} alt={image.alt} />
            </button>
          ))}
        </div>
      ) : null}
      <dialog
        ref={dialog}
        className="wl-lightbox"
        aria-label={`${title} photographs`}
        onClose={() => trigger.current?.focus()}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') setSelected((selected + 1) % images.length);
          if (event.key === 'ArrowLeft')
            setSelected((selected - 1 + images.length) % images.length);
        }}
      >
        <div className="wl-lightbox-toolbar">
          <span>
            Photograph {selected + 1} of {images.length}
          </span>
          <button type="button" onClick={() => dialog.current?.close()}>
            Close ✕
          </button>
        </div>
        <StorefrontImage src={current?.url ?? null} alt={current?.alt ?? title} />
        {images.length > 1 ? (
          <div className="wl-actions">
            <button
              type="button"
              onClick={() => setSelected((selected - 1 + images.length) % images.length)}
            >
              Previous photograph
            </button>
            <button type="button" onClick={() => setSelected((selected + 1) % images.length)}>
              Next photograph
            </button>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}

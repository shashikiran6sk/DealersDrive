import { PHOTO_GALLERY_TEXT, ZOOM, ZOOM_IN_GLYPH, ZOOM_OUT_GLYPH } from './photo-gallery.constants';
import type { ZoomAction } from './photo-gallery.types';

export interface GalleryZoomControlsProps {
  scale: number;
  onZoom: (action: ZoomAction) => void;
}

const CONTROL_CLASS =
  'dd-arrow static h-[38px] w-[38px] transform-none bg-white/90 text-[18px] max-md:h-11 max-md:w-11';

export function GalleryZoomControls({ scale, onZoom }: GalleryZoomControlsProps) {
  return (
    <div
      role="group"
      aria-label={PHOTO_GALLERY_TEXT.zoomControls}
      className="absolute top-[14px] right-[14px] z-[4] flex gap-2 max-md:top-[6px] max-md:right-[6px]"
    >
      <button
        type="button"
        onClick={() => onZoom('out')}
        disabled={scale <= ZOOM.min}
        aria-label={PHOTO_GALLERY_TEXT.zoomOut}
        className={CONTROL_CLASS}
      >
        <span aria-hidden="true">{ZOOM_OUT_GLYPH}</span>
      </button>
      <button
        type="button"
        onClick={() => onZoom('in')}
        disabled={scale >= ZOOM.max}
        aria-label={PHOTO_GALLERY_TEXT.zoomIn}
        className={CONTROL_CLASS}
      >
        <span aria-hidden="true">{ZOOM_IN_GLYPH}</span>
      </button>
    </div>
  );
}

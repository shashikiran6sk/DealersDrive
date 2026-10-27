export interface GalleryChevronProps {
  direction: 'previous' | 'next';
  className?: string;
}

const PATHS = {
  previous: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
} as const;

export function GalleryChevron({ direction, className }: GalleryChevronProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={PATHS[direction]} />
    </svg>
  );
}

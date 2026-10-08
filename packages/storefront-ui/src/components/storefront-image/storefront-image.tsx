'use client';

import { useState } from 'react';

import { responsiveImageSet } from '../../presentation';

export function StorefrontImage({
  src,
  alt,
  priority = false,
  className = '',
}: {
  src: string | null;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src)
    return (
      <div
        className={`wl-image-fallback ${className}`}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
      >
        <span>{failed ? 'Photograph unavailable' : 'Photography coming soon'}</span>
      </div>
    );
  return (
    <img
      className={className}
      src={src}
      srcSet={responsiveImageSet(src)}
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 640px"
      alt={alt}
      width={1600}
      height={1000}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      onError={() => setFailed(src)}
    />
  );
}

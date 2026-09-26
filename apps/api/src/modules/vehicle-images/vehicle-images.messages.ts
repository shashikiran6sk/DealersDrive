export const IMAGES_CLOSED =
  'Images can only be changed while the listing is in review or waiting for changes.';

export const IMAGES_FULL = (max: number): string =>
  `A vehicle can carry at most ${max} images. Remove one before adding another.`;

export const IMAGE_NOT_FOUND = 'That image is not attached to this vehicle.';

export const UPLOAD_MISMATCH = 'The uploaded file does not match what was declared.';

export const UPLOAD_NOT_IMAGE =
  'That file is not a JPEG, PNG or WebP image, whatever its name or type says.';

export const ORDER_MISMATCH =
  'The order must list every image on this vehicle exactly once, and nothing else.';

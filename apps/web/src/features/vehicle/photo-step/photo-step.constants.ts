import { IMAGE_MAX_BYTES, IMAGE_MIME_TYPES, creditsLabel } from '@dealers-drive/contracts';

export const PHOTO_GUIDE_HREF = '/dealer/photo-guide';

export const PHOTO_ACCEPT = IMAGE_MIME_TYPES.join(',');

export const PHOTO_MAX_EDGE = 4096;

export const PHOTO_RESIZE_QUALITY = 0.9;

export { IMAGE_MAX_BYTES };

export const PHOTO_STEP_TEXT = {
  intro:
    'Choose who photographs this car. Every photograph is checked by our team and finished in the studio before the car goes live, so buyers see the same quality on every listing.',
  dealerTitle: 'Upload the photos yourself',
  dealerBody:
    'Take ten photographs with your phone, following our illustrated guide. We check them, process them in the studio and publish them as your photographs.',
  studioTitle: 'Dealers-Drive photoshoot',
  studioBody:
    'Submit the details now. Our photographer visits your yard, shoots the car and publishes the finished photographs.',
  studioAvailable: (district: string | null) =>
    district ? `Available in ${district}` : 'Available for your dealership',
  studioUnavailable: (district: string | null) =>
    district ? `Not yet available in ${district}` : 'Not yet available for your location',
  cost: (credits: number) => creditsLabel(credits),
  creditPrice: (price: string) => `1 credit = ${price} + GST`,
  chosen: 'Selected',
  choose: 'Choose',
  planFailed: 'That choice could not be saved. Try again.',
  guideTitle: 'The Dealers-Drive photo standard',
  guideLink: 'Open the full guide',
  progress: (done: number) => `${String(done)} of 10 photographs`,
  progressDone: 'All ten photographs are in. You can submit the car.',
  shotLabel: (number: number) => `${String(number)}.`,
  upload: 'Upload photo',
  uploading: 'Uploading…',
  replace: 'Replace',
  remove: 'Remove',
  howToShoot: 'How to take it',
  extrasTitle: 'Anything else worth showing',
  extrasBody:
    'Optional: the engine bay, the boot, the tyres, or a scratch the buyer should know about.',
  extrasCount: (count: number, max: number) => `${String(count)} of ${String(max)}`,
  addExtra: 'Add a photograph',
  studioNextTitle: 'What happens next',
  studioNext: [
    'Submit the car for review on the next step.',
    'Our team calls you to book a time at your yard — usually within two working days.',
    'We shoot the car, process the photographs and publish the listing once it is approved.',
  ],
  back: 'Back',
  continue: 'Continue to review',
  failed: 'That photograph could not be uploaded. Try again.',
  tooLarge: 'That file is too large even after resizing. Choose a smaller photograph.',
  wrongType: 'Choose a JPEG, PNG or WebP photograph.',
  locked: 'The photographs can be changed again if our team asks for changes.',
  thumbnailAlt: (label: string) => `Your ${label.toLowerCase()} photograph`,
} as const;

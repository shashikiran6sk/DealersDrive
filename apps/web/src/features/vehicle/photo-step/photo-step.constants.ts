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
  creditPrice: (price: string, gstPercent: number) =>
    gstPercent > 0 ? `1 credit = ${price} + GST` : `1 credit = ${price}`,
  chosen: 'Selected',
  choose: 'Choose',
  planFailed: 'That choice could not be saved. Try again.',
  guideTitle: 'Ten photos that sell a car',
  guideBody:
    'Follow the Dealers-Drive photo guide: one lap round the car for photos 1 to 6, kneeling at every stop, then 7 to 10 inside. About ten minutes per car, nothing but a phone.',
  beforeYouShoot: 'Before you shoot',
  aimFor: 'Aim for this',
  aimForAlt: (title: string) => `Example of a good ${title.toLowerCase()} photo`,
  jumpTo: (number: number, title: string) => `Photo ${String(number)}: ${title}`,
  guideLink: 'Open the full guide',
  progress: (done: number) => `${String(done)} of 10 photographs`,
  progressDone: 'All ten photographs are in. You can submit the car.',
  upload: 'Upload photo',
  uploading: 'Uploading…',
  replace: 'Replace',
  remove: 'Remove',
  howToShoot: 'Step by step, what to check and what to avoid',
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
  modeLabel: 'How do you want to upload?',
  modeAll: 'All at once',
  modeAllHint: 'Pick every photo in one go',
  modeOne: 'One shot at a time',
  modeOneHint: 'Upload beside each step of the guide',
  bulkTitle: 'Upload all your photos at once',
  bulkBody:
    'Choose at least ten photos from your gallery in one go — the ten shots in the guide, and any extras. Our team puts them in order when they process them.',
  bulkChoose: 'Choose photos',
  bulkCount: (count: number, required: number) =>
    `${String(count)} of ${String(required)} photos uploaded`,
  bulkReady: (count: number) =>
    `${String(count)} photos uploaded. You can continue to review and submit the car.`,
  bulkShotsAlsoCount: (count: number) =>
    count === 1
      ? 'The 1 shot you uploaded one at a time counts too.'
      : `The ${String(count)} shots you uploaded one at a time count too.`,
  bulkUploaded: 'Uploaded',
  bulkWaiting: 'Waiting…',
  bulkFailed: 'Not uploaded',
  bulkRetry: 'Try again',
  bulkUnnamed: (number: number) => `Photo ${String(number)}`,
  bulkRemove: (name: string) => `Remove ${name}`,
  bulkListLabel: 'Uploaded photos',
  unsortedKept: (count: number) =>
    count === 1
      ? '1 photo uploaded all at once is kept. Our team will place it.'
      : `${String(count)} photos uploaded all at once are kept. Our team will place them.`,
  skippedType: (count: number) =>
    count === 1
      ? 'One file was not a JPEG, PNG or WebP photo and was left out.'
      : `${String(count)} files were not JPEG, PNG or WebP photos and were left out.`,
  leftOut: (count: number, max: number) =>
    count === 1
      ? `One photo was left out: a car can have at most ${String(max)} photos.`
      : `${String(count)} photos were left out: a car can have at most ${String(max)} photos.`,
  photosFull: (max: number) =>
    `This car has ${String(max)} photos, the most it can have. Remove one to add another.`,
} as const;

export const BULK_UPLOAD_ANCHOR = 'bulk-upload';

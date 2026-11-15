import { IMAGE_MAX_BYTES, IMAGE_MIME_TYPES } from '@dealers-drive/contracts';

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
    'Choose the ten photos, and any extras, from your gallery in one go. We put them in the guide’s order by the time each was taken, so shoot them 1 to 10. You check the order before anything uploads.',
  bulkChoose: 'Choose photos',
  bulkAlreadyIn: (count: number) =>
    `${String(count)} of the ten are already uploaded. New photos fill the shots still missing.`,
  arrangeTitle: 'Check the order',
  arrangeBody:
    'Each photo should match the example under it. If two are the wrong way round, tap one and then the other to swap them.',
  arrangeSelected: (label: string) => `Now tap where your ${label.toLowerCase()} photo should go.`,
  arrangeExtras: 'Extras',
  arrangeExtrasEmpty: 'Photos beyond the ten land here. Tap one to move it into a shot.',
  arrangeMissing: (labels: readonly string[]) => `Still missing: ${labels.join(', ')}.`,
  cellEmpty: 'No photo yet',
  cellUploaded: 'Uploaded',
  cellFailed: 'Not uploaded',
  cellSelect: (position: string) => `Select the photo for ${position}`,
  cellMoveHere: (position: string) => `Move the selected photo to ${position}`,
  cellRemove: (position: string) => `Remove the photo for ${position}`,
  cellPosition: (number: number, label: string) => `${String(number)} · ${label}`,
  extraPosition: (number: number) => `Extra ${String(number)}`,
  addMore: 'Add more photos',
  startOver: 'Start over',
  uploadAll: (count: number) => (count === 1 ? 'Upload 1 photo' : `Upload ${String(count)} photos`),
  uploadAllAndContinue: (count: number) =>
    count === 1 ? 'Upload 1 photo and continue' : `Upload ${String(count)} photos and continue`,
  uploadingProgress: (done: number, total: number) =>
    `Uploading ${String(done)} of ${String(total)}…`,
  uploadFailedCount: (count: number) =>
    count === 1
      ? 'One photo could not be uploaded. It is still here: try again.'
      : `${String(count)} photos could not be uploaded. They are still here: try again.`,
  skippedType: (count: number) =>
    count === 1
      ? 'One file was not a JPEG, PNG or WebP photo and was left out.'
      : `${String(count)} files were not JPEG, PNG or WebP photos and were left out.`,
  leftOut: (count: number, max: number) =>
    count === 1
      ? `One photo was left out: there is room for ten shots and ${String(max)} extras.`
      : `${String(count)} photos were left out: there is room for ten shots and ${String(max)} extras.`,
  bulkDone: 'All your photos are uploaded.',
} as const;

export const BULK_UPLOAD_ANCHOR = 'bulk-upload';

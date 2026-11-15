import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

const MEDIA_ID = '5f0b2a5c-7f4e-4f0d-9c36-1d2e3f4a5b6c';

export const dealerPhotosDocs: ModuleDocs = {
  tag: DOC_TAGS.dealerPhotos,
  description:
    'Who photographs a car, and the dealer’s own photographs (**R45**, partially revised). ' +
    'Before submitting, the dealer chooses a **photo plan**: `DEALER` (they photograph it to ' +
    'the ten-shot Dealers-Drive standard and upload here) or `DEALERS_DRIVE` (the team ' +
    'photographs it — only where the dealership’s district has `photographyAvailable`).\n\n' +
    '**A dealer’s photograph is never published.** It is stored with owner type ' +
    '`VEHICLE_SUBMISSION`, which the public media route refuses, and reaches the review team ' +
    'only, through `GET /v1/admin/listings/{id}` → `submittedPhotos` and the download route below. They check it, process ' +
    'it in StudioCar and upload the finished file through the admin image routes with credit ' +
    '`DEALER`; only that file can go live.\n\n' +
    'Every write is refused unless `feature.dealerPhotos` is on and the listing is `DRAFT` or ' +
    '`CHANGES_REQUESTED`. Uploads are presign → PUT → commit, and the commit checks the size ' +
    'and the JPEG/PNG/WebP signature before attaching the file. One photograph per standard ' +
    'slot (a new one replaces the old); up to six `EXTRA`. Photographs uploaded "all at once" ' +
    'go to `UNSORTED` (up to sixteen) and the review team places them; once any is unsorted, ' +
    'submission needs ten photographs in total rather than the ten named shots.',
  operations: [
    {
      method: 'get',
      path: '/v1/dealer/vehicles/:id/photos',
      operationId: 'getVehiclePhotos',
      tag: DOC_TAGS.dealerPhotos,
      summary: 'The photo plan and the dealer’s photographs',
      description:
        'Everything the wizard’s Photos step renders: the plan, whether a Dealers-Drive ' +
        'photoshoot covers the dealership’s district, the ten standard slots with any photograph ' +
        'in each (short-lived signed URLs), the unsorted photographs, the extras, what is missing, ' +
        '`needed` (how many more photographs submission wants) and `ready` — whether ' +
        'submission would pass as far as photographs go.',
      audience: 'dealer',
      permission: 'vehicle:read',
      params: 'IdParam',
      responses: [{ status: 200, description: 'The photographs.', schema: 'DealerVehiclePhotos' }],
      errors: [400, 401, 403, 404],
    },
    {
      method: 'put',
      path: '/v1/dealer/vehicles/:id/photo-plan',
      operationId: 'setVehiclePhotoPlan',
      tag: DOC_TAGS.dealerPhotos,
      summary: 'Choose who photographs the car',
      description:
        '`DEALERS_DRIVE` outside a covered district is `422 PHOTOSHOOT_UNAVAILABLE`. Changing ' +
        'the plan keeps any photographs already uploaded. With listing credits on, the plan sets ' +
        'what submission holds.',
      audience: 'dealer',
      permission: 'vehicle:write',
      params: 'IdParam',
      requestBody: { schema: 'SetPhotoPlanInput', example: { plan: 'DEALER' } },
      responses: [{ status: 200, description: 'The photographs.', schema: 'DealerVehiclePhotos' }],
      errors: [400, 401, 403, 404, 409, 422],
    },
    {
      method: 'post',
      path: '/v1/dealer/vehicles/:id/photos/presign',
      operationId: 'presignVehiclePhoto',
      tag: DOC_TAGS.dealerPhotos,
      summary: 'Get a signed upload URL for one photograph',
      description:
        'Step 1 of 3. Only with plan `DEALER` (`409 PHOTO_PLAN_NOT_DEALER`). The slot travels ' +
        'in the server-chosen key, `vehicles/{vehicleId}/submitted/{mediaId}/{slot}.{ext}`.',
      audience: 'dealer',
      permission: 'vehicle:write',
      params: 'IdParam',
      requestBody: {
        schema: 'DealerPhotoPresignInput',
        example: {
          slot: 'FRONT_THREE_QUARTER',
          fileName: 'IMG_2041.jpg',
          mimeType: 'image/jpeg',
          bytes: 2_481_337,
        },
      },
      responses: [{ status: 201, description: 'A signed upload URL.', schema: 'PresignResponse' }],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/dealer/vehicles/:id/photos/:mediaId/commit',
      operationId: 'commitVehiclePhoto',
      tag: DOC_TAGS.dealerPhotos,
      summary: 'Attach an uploaded photograph',
      description:
        'Step 3 of 3. Checks the stored object’s size and first bytes; a mismatch deletes it ' +
        '(`422 UPLOAD_MISMATCH` / `UPLOAD_NOT_IMAGE`). A standard slot that already has a ' +
        'photograph has it replaced. Idempotent: committing twice answers the same.',
      audience: 'dealer',
      permission: 'vehicle:write',
      params: 'VehiclePhotoParam',
      responses: [{ status: 200, description: 'The photographs.', schema: 'DealerVehiclePhotos' }],
      errors: [400, 401, 403, 404, 409, 422],
    },
    {
      method: 'post',
      path: '/v1/admin/listings/:id/submitted-photos/download',
      operationId: 'downloadSubmittedPhotos',
      tag: DOC_TAGS.dealerPhotos,
      summary: 'Download the dealer’s photographs — one, or all as a zip',
      description:
        'For the review team, ahead of StudioCar. Without `mediaId` the API zips every ' +
        'photograph in shooting order (stored, not recompressed), keeps the archive under ' +
        '`archives/submitted-photos/{listingId}/{fingerprint}.zip` — so a second click on an ' +
        'unchanged set reuses it — and answers with a 5-minute signed link straight to storage. ' +
        'Files are named for the car as the dealer listed it: ' +
        '`2016-hyundai-creta-sx.zip`, containing ' +
        '`2016-hyundai-creta-sx-01-front-three-quarter-driver-side.jpg` and so on. With ' +
        '`mediaId`, the link is to that one photograph under the same naming. The link saves ' +
        'the file as an attachment; the bytes never pass through the web app. Audited.',
      audience: 'admin',
      permission: 'admin:listing:moderate',
      params: 'IdParam',
      requestBody: {
        schema: 'SubmittedPhotosDownloadInput',
        description: 'Empty for every photograph as a zip, or one `mediaId`.',
        example: {},
      },
      responses: [
        {
          status: 200,
          description: 'A short-lived download link.',
          schema: 'SubmittedPhotosDownload',
          example: {
            url: 'https://…r2.cloudflarestorage.com/…/archives/submitted-photos/…zip?X-Amz-…',
            fileName: '2016-hyundai-creta-sx.zip',
            expiresInSeconds: 300,
          },
        },
      ],
      errors: [400, 401, 403, 404, 422],
    },
    {
      method: 'delete',
      path: '/v1/dealer/vehicles/:id/photos/:mediaId',
      operationId: 'deleteVehiclePhoto',
      tag: DOC_TAGS.dealerPhotos,
      summary: 'Remove one of the dealer’s photographs',
      description: `Removes it and deletes the file, e.g. \`${MEDIA_ID}\`.`,
      audience: 'dealer',
      permission: 'vehicle:write',
      params: 'VehiclePhotoParam',
      responses: [{ status: 200, description: 'The photographs.', schema: 'DealerVehiclePhotos' }],
      errors: [400, 401, 403, 404, 409],
    },
  ],
};

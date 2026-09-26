import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

const LISTING_ID = '6a1f3c2e-8b4d-4e5f-9a7b-1c2d3e4f5a6b';
const MEDIA_ID = 'bc7de20d-30a4-41ed-a364-8f34771a20a8';

const IMAGES_EXAMPLE = {
  items: [
    {
      mediaId: MEDIA_ID,
      position: 0,
      isPrimary: true,
      url: 'http://localhost:4000/private?key=vehicles%2F…%2Foriginal.jpg&expiresAt=…&signature=…',
      fileName: 'creta-front-three-quarter.jpg',
      mimeType: 'image/jpeg',
      bytes: 1_284_512,
      width: 2400,
      height: 1600,
      uploadedAt: '2026-09-27T10:12:00.000Z',
    },
  ],
  min: 6,
  max: 20,
  canEdit: true,
};

export const vehicleImagesDocs: ModuleDocs = {
  tag: DOC_TAGS.media,
  description:
    'Vehicle images (**R45**; F035 as reinterpreted). Dealers-Drive photographs every car ' +
    'itself; the processed files are uploaded here by an admin. **There is no dealer route ' +
    'that writes vehicle media**, and nothing here talks to StudioCar.\n\n' +
    '**The upload is three calls.** `POST …/images/presign` returns a signed URL; the ' +
    'console `PUT`s the bytes straight to storage; `POST …/images/{mediaId}/commit` checks ' +
    'the object — its size against the declaration and its first bytes against the JPEG, ' +
    'PNG and WebP signatures — and only then attaches it to the vehicle. The storage key is ' +
    'always the server’s: `vehicles/{vehicleId}/{mediaId}/original.{ext}`.\n\n' +
    'Images may change only while the listing is `PENDING_REVIEW` or `CHANGES_REQUESTED`. ' +
    'Every route requires `admin:media:upload` and answers `Cache-Control: no-store`.',
  operations: [
    {
      method: 'post',
      path: '/v1/admin/listings/:id/images/presign',
      operationId: 'presignListingImage',
      tag: DOC_TAGS.media,
      summary: 'Get a signed upload URL for one vehicle image',
      description:
        'Step 1 of 3. `id` is the listing. The client names the file, its type and size; it ' +
        'never names a path or a vehicle. JPEG, PNG and WebP up to 10 MB, and at most ' +
        '`max` (20) images per vehicle — a full vehicle is `409 VEHICLE_IMAGES_FULL`. The ' +
        'declared type and length are signed into the URL.',
      audience: 'admin',
      permission: 'admin:media:upload',
      params: 'IdParam',
      requestBody: {
        schema: 'VehicleImagePresignInput',
        description: 'The file about to be uploaded.',
        example: {
          fileName: 'creta-front-three-quarter.jpg',
          mimeType: 'image/jpeg',
          bytes: 1_284_512,
          width: 2400,
          height: 1600,
        },
      },
      responses: [
        {
          status: 201,
          description:
            'A signed upload URL. Send the returned `headers` verbatim on the PUT, then commit ' +
            '`mediaId`.',
          schema: 'PresignResponse',
          example: {
            mediaId: MEDIA_ID,
            uploadUrl: 'http://localhost:4000/uploads?key=…&signature=…',
            method: 'PUT',
            headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '1284512' },
            expiresInSeconds: 900,
            maxBytes: 1_284_512,
          },
        },
      ],
      errors: [400, 401, 403, 404, 409],
    },
    {
      method: 'post',
      path: '/v1/admin/listings/:id/images/:mediaId/commit',
      operationId: 'commitListingImage',
      tag: DOC_TAGS.media,
      summary: 'Attach an uploaded image to the vehicle',
      description:
        'Step 3 of 3. Verifies the object landed at the length that was declared and that ' +
        'its first bytes are a JPEG, PNG or WebP of the declared type — a file that is not ' +
        'is `422 UPLOAD_NOT_IMAGE` whatever its name said, and is deleted. The image is ' +
        'appended at the end of the gallery; the first image becomes the primary.\n\n' +
        'An upload made for another listing’s vehicle is a 404. Committing an image that ' +
        'is already attached returns the gallery unchanged. Audited as `vehicle.image_added`.',
      audience: 'admin',
      permission: 'admin:media:upload',
      params: 'ListingImageParam',
      responses: [
        {
          status: 200,
          description: 'The vehicle’s images, in order.',
          schema: 'AdminVehicleImages',
          example: IMAGES_EXAMPLE,
        },
      ],
      errors: [400, 401, 403, 404, 409, 422],
    },
    {
      method: 'delete',
      path: '/v1/admin/listings/:id/images/:mediaId',
      operationId: 'deleteListingImage',
      tag: DOC_TAGS.media,
      summary: 'Remove one image from the vehicle',
      description:
        'Detaches the image, deletes its file and closes the gap in the order. Removing the ' +
        'primary promotes the next image in the same transaction, so a vehicle with images ' +
        'always has exactly one primary. Audited as `vehicle.image_removed`. `id` is the ' +
        `listing, e.g. \`${LISTING_ID}\`.`,
      audience: 'admin',
      permission: 'admin:media:upload',
      params: 'ListingImageParam',
      responses: [
        {
          status: 200,
          description: 'The vehicle’s remaining images, in order.',
          schema: 'AdminVehicleImages',
          example: { ...IMAGES_EXAMPLE, items: [] },
        },
      ],
      errors: [400, 401, 403, 404, 409],
    },
  ],
};

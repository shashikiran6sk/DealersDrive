import type { ModuleDocs } from '../../docs/spec.js';

/**
 * C14, plus the two storage routes that stand in for R2 locally.
 *
 * The upload contract is presign → PUT → commit, and it is that shape for one
 * reason: photo bytes never pass through this API. A dealer uploading twelve
 * 4 MB photos would otherwise occupy a request worker for the duration of each,
 * and image processing would compete with request handling for CPU.
 */
export const mediaDocs: ModuleDocs = {
  tag: 'Media',
  description:
    'Vehicle photos: signed direct-to-storage uploads, ordering, and delivery.\n\n' +
    '**The flow is three calls.** `POST /v1/dealer/media/presign` returns a signed URL; the ' +
    'client `PUT`s the bytes straight to storage; `POST /v1/dealer/media/{id}/commit` hands ' +
    'the file to the processor, which re-encodes it, strips EXIF (a phone photo carries the ' +
    "seller's GPS coordinates) and computes a blurhash. Commit returns **202** — the file is " +
    'accepted, not ready — with a `poll` URL.',
  operations: [
    {
      method: 'post',
      path: '/v1/dealer/media/presign',
      operationId: 'presignMedia',
      tag: 'Media',
      summary: 'Get a signed upload URL for a photo',
      description:
        'Step 1 of 3. `ownerId` must be a vehicle (or dealership) **the acting dealer owns** — ' +
        "presigning against another dealer's vehicle is a 404, so the upload path cannot be " +
        "used to attach photos to someone else's car.\n\n" +
        'The declared `mimeType` and `bytes` are signed into the URL, so storage rejects a ' +
        'file that does not match what was declared. JPEG, PNG and WebP up to 10 MB.\n\n' +
        'Clients are expected to down-scale before uploading (the web app compresses to ' +
        '2400px at q0.85); the cap is a backstop, not the target.',
      audience: 'dealer',
      permission: 'vehicle:write',
      requestBody: {
        schema: 'MediaPresignInput',
        description: 'What is about to be uploaded, and what it belongs to.',
        example: {
          ownerType: 'VEHICLE',
          ownerId: '55714b20-2469-4280-87fb-1ac6ea79a9c5',
          fileName: 'front-three-quarter.jpg',
          mimeType: 'image/jpeg',
          bytes: 1_284_512,
          width: 2400,
          height: 1800,
        },
      },
      responses: [
        {
          status: 201,
          description:
            'A signed upload URL. `mediaId` is the id to commit; send the returned `headers` ' +
            'verbatim on the PUT or the signature will not match.',
          schema: 'PresignResponse',
          example: {
            mediaId: 'bc7de20d-30a4-41ed-a364-8f34771a20a8',
            uploadUrl:
              'http://localhost:4000/uploads?key=vehicles%2F55714b20%2Fbc7de20d.jpg&contentType=image%2Fjpeg&contentLength=1284512&expiresAt=1787000000&signature=9f2c…',
            method: 'PUT',
            headers: { 'Content-Type': 'image/jpeg' },
            expiresInSeconds: 900,
            maxBytes: 10_485_760,
          },
        },
      ],
      errors: [400, 401, 403, 404, 422],
    },
    {
      method: 'post',
      path: '/v1/dealer/media/:id/commit',
      operationId: 'commitMedia',
      tag: 'Media',
      summary: 'Confirm an upload and queue processing',
      description:
        'Step 3 of 3. Confirms the bytes landed and queues re-encoding, EXIF stripping and ' +
        'blurhash generation.\n\n' +
        '**202, not 200.** The photo is accepted but not yet renderable: poll the returned ' +
        '`poll` URL (`GET /v1/dealer/media/{id}`) until `status` is `READY`. A photo only ' +
        'counts towards the minimum-photo requirement once it is READY, which is why the ' +
        'wizard cannot publish the instant the last upload finishes.\n\n' +
        '`position` is optional; omit it and the photo is appended.',
      audience: 'dealer',
      permission: 'vehicle:write',
      params: 'IdParam',
      requestBody: {
        schema: 'MediaCommitInput',
        description: 'Optional position in the gallery.',
        required: false,
        example: { position: 0 },
      },
      responses: [
        {
          status: 202,
          description: 'Accepted for processing. Poll until READY.',
          schema: 'MediaCommitResponse',
          example: {
            mediaId: 'bc7de20d-30a4-41ed-a364-8f34771a20a8',
            status: 'PENDING',
            position: 0,
            poll: '/v1/dealer/media/bc7de20d-30a4-41ed-a364-8f34771a20a8',
            estimatedSeconds: 4,
          },
        },
      ],
      errors: [400, 401, 403, 404, 422],
    },
    {
      method: 'get',
      path: '/v1/dealer/media/:id',
      operationId: 'getMedia',
      tag: 'Media',
      summary: "Poll one photo's processing status",
      description:
        'The poll target from commit. `status` moves PENDING → READY, or → FAILED with ' +
        '`warnings[]` explaining why (too small, corrupt, unsupported). `url` is null until ' +
        'the derivatives exist.',
      audience: 'dealer',
      permission: 'vehicle:read',
      params: 'IdParam',
      responses: [
        { status: 200, description: 'The photo and its status.', schema: 'VehicleMediaDto' },
      ],
      errors: [400, 401, 403, 404],
    },
    {
      method: 'delete',
      path: '/v1/dealer/media/:id',
      operationId: 'deleteMedia',
      tag: 'Media',
      summary: 'Delete a photo',
      description: "Removes the photo and its derivatives. Another dealer's photo id is a 404.",
      audience: 'dealer',
      permission: 'vehicle:write',
      params: 'IdParam',
      responses: [{ status: 204, description: 'Deleted.' }],
      errors: [400, 401, 403, 404],
    },
    /*
     * ── Reconstruction slice ──────────────────────────────────────────────
     * `PUT /v1/dealer/vehicles/:id/media/order` — `reorderVehicleMedia` — is
     * **F035**. It needs `VehicleMedia` and `ReorderMediaInput`, neither of
     * which exists yet, and `buildSchemaCatalogue()` would throw on the
     * missing input schema. It returns with that feature, alongside
     * `service.reorder()` and the route itself in `media.routes.ts`.
     */
  ],
};

/**
 * The two routes that stand in for Cloudflare R2 in local development.
 *
 * Mounted outside `/v1` on purpose: they are storage, not API surface. In
 * production these are R2 and the Cloudflare Images origin, and no client code
 * changes — the presign response already points wherever the bytes should go.
 */
export const storageDocs: ModuleDocs = {
  tag: 'Storage (local only)',
  description:
    'The local stand-ins for object storage. `PUT /uploads` terminates a presigned upload; ' +
    '`GET /media/…` serves processed images. Both are replaced by R2 and the Cloudflare ' +
    'Images origin in every deployed environment, which is why they live outside `/v1` and ' +
    'take no session.',
  operations: [
    {
      method: 'put',
      path: '/uploads',
      operationId: 'putUpload',
      tag: 'Storage (local only)',
      summary: 'Terminate a presigned upload',
      description:
        'Step 2 of the upload flow, and the only endpoint in the API that takes raw bytes.\n\n' +
        'Do not call this by hand: every query parameter comes from the `uploadUrl` that ' +
        '`POST /v1/dealer/media/presign` returned, already signed. Before a byte is written it ' +
        'verifies the HMAC, the expiry, the declared content-type **and** the declared ' +
        'content-length — the same conditions an S3 presigned PUT enforces, so a client that ' +
        'works locally works against R2 unchanged.\n\n' +
        'A body whose length disagrees with the signature is a 422 `UPLOAD_LENGTH_MISMATCH`; ' +
        'an expired or tampered signature is a 422 `UPLOAD_SIGNATURE_INVALID`. Bodies are ' +
        'capped at 12 MB.\n\n' +
        '*Swagger UI cannot exercise this usefully — the body must be the exact bytes the ' +
        'signature was issued for.*',
      audience: 'internal',
      inlineQuery: {
        name: 'UploadQuery',
        schema: {
          type: 'object',
          required: ['key', 'contentType', 'contentLength', 'expiresAt', 'signature'],
          properties: {
            key: {
              type: 'string',
              minLength: 1,
              maxLength: 300,
              description: 'Storage object key.',
            },
            contentType: {
              type: 'string',
              minLength: 1,
              maxLength: 120,
              description: 'Must equal the type that was signed.',
            },
            contentLength: {
              type: 'integer',
              minimum: 1,
              description: 'Must equal the body length exactly.',
            },
            expiresAt: { type: 'integer', description: 'Unix seconds; past this the URL is dead.' },
            signature: {
              type: 'string',
              minLength: 16,
              maxLength: 256,
              description: 'HMAC over the four fields above.',
            },
          },
        },
      },
      requestBody: {
        schema: '__raw_binary__',
        description: 'The file, as raw bytes. `Content-Type` must match the signed type.',
      },
      responses: [
        {
          status: 200,
          description: 'Stored.',
          inlineSchema: {
            type: 'object',
            required: ['ok'],
            properties: { ok: { type: 'boolean' } },
          },
          example: { ok: true },
        },
      ],
      errors: [400, 422],
    },
    {
      method: 'get',
      path: '/media/vehicles/by-media/:mediaId/:width.webp',
      operationId: 'getMediaDerivative',
      tag: 'Storage (local only)',
      summary: 'Serve a processed image',
      description:
        'Content-addressed image delivery. A new upload is a new id and therefore a new URL, ' +
        'so a cache never has to be invalidated — hence ' +
        '`Cache-Control: public, max-age=31536000, immutable`.\n\n' +
        'Available widths are 320, 640, 1024 and 1600; anything else is a 404. Unlike the ' +
        'JSON API this route sends `Cross-Origin-Resource-Policy: cross-origin`, because a ' +
        'media origin is a different host from the web app in every environment and the ' +
        'strict default would stop the browser embedding the image.\n\n' +
        '*The path ends in a literal `.webp`, which is why the width parameter is documented ' +
        'as `width.webp`.*',
      audience: 'internal',
      responses: [
        {
          status: 200,
          description: 'The image bytes.',
          contentType: 'image/webp',
          inlineSchema: { type: 'string', format: 'binary' },
          headers: {
            'Cache-Control': {
              description: 'Immutable for a year.',
              schema: { type: 'string', example: 'public, max-age=31536000, immutable' },
            },
            'Cross-Origin-Resource-Policy': {
              description: 'What a public media origin sends.',
              schema: { type: 'string', example: 'cross-origin' },
            },
          },
        },
      ],
      errors: [404],
    },
  ],
};

import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

export const storageDocs: ModuleDocs = {
  tag: DOC_TAGS.storage,
  description:
    'The local stand-ins for object storage. `PUT /uploads` terminates a presigned upload; ' +
    '`GET /private` answers a signed read URL; `GET /media/…` serves published images. All ' +
    'three are replaced by R2 and the Cloudflare ' +
    'Images origin in every deployed environment, which is why they live outside `/v1` and ' +
    'take no session.',
  operations: [
    {
      method: 'put',
      path: '/uploads',
      operationId: 'putUpload',
      tag: DOC_TAGS.storage,
      summary: 'Terminate a presigned upload',
      description:
        'Step 2 of the upload flow, and the only endpoint in the API that takes raw bytes.\n\n' +
        'Do not call this by hand: every query parameter comes from the `uploadUrl` that ' +
        'a presign route (a vehicle image, a yard photograph, a KYC document) returned, ' +
        'already signed. Before a byte is written it ' +
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
      path: '/private',
      operationId: 'getPrivateObject',
      tag: DOC_TAGS.storage,
      summary: 'Read an object through a signed URL',
      description:
        'The local stand-in for an S3 presigned GET: what `signedReadUrl()` hands out for a ' +
        'private object — a moderator\u2019s preview of a vehicle image not yet public, a ' +
        'dealer\u2019s own yard photograph. Every parameter comes from that URL, already ' +
        'signed; an expired or altered one is a 404, never a hint about which part was ' +
        'wrong. Sent `Cache-Control: private, no-store`.',
      audience: 'internal',
      inlineQuery: {
        name: 'PrivateReadQuery',
        schema: {
          type: 'object',
          required: ['key', 'expiresAt', 'signature'],
          properties: {
            key: { type: 'string', minLength: 1, maxLength: 300, description: 'Storage key.' },
            expiresAt: { type: 'integer', description: 'Epoch milliseconds.' },
            signature: {
              type: 'string',
              minLength: 16,
              maxLength: 256,
              description: 'HMAC over the key and the expiry.',
            },
          },
        },
      },
      responses: [
        {
          status: 200,
          description: 'The object bytes.',
          contentType: 'image/jpeg',
          inlineSchema: { type: 'string', format: 'binary' },
        },
      ],
      errors: [400, 404],
    },
    {
      method: 'get',
      path: '/media/by-media/:mediaId/:width.webp',
      operationId: 'getMediaDerivative',
      tag: DOC_TAGS.storage,
      summary: 'Serve a processed image',
      description:
        'Content-addressed image delivery for every kind of image the product stores — a ' +
        'vehicle photograph and a dealership yard photograph are the same bytes behind the ' +
        'same handler. **A vehicle image is served only while its listing is `ACTIVE` or `RESERVED` ' +
        'and its dealership is `ACTIVE`** ' +
        '(**R45**): before approval, after a sale or a removal it is a 404, and a moderator ' +
        'previews it through a signed read URL instead. Media readiness and public visibility can ' +
        'change while the id stays the same. Both successful responses and denials send ' +
        '`Cache-Control: no-store`, so future requests observe suspension, removal and reinstatement.\n\n' +
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
              description: 'Do not retain a response across mutable visibility decisions.',
              schema: { type: 'string', example: 'no-store' },
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

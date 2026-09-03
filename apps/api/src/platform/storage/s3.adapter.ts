import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '../../config/env.js';
import type { PresignedUpload, StoragePort, StoredObject } from './storage.port.js';

/**
 * One adapter, two deployments: MinIO on a laptop, Cloudflare R2 in production.
 *
 * They are the same code because they are the same protocol — S3 with SigV4 —
 * and the only things that differ are `S3_ENDPOINT` and the two keys. That is
 * the entire content of the claim "changing provider is configuration": there
 * is no `if (isR2)` in this file, and there is no second implementation to keep
 * in step with this one.
 *
 * R2 ignores regions but SigV4 requires one in the signature, which is why
 * `auto` is the documented value for both.
 */
export function createS3Storage(client: S3Client = createS3Client()): StoragePort {
  const bucket = env.S3_BUCKET;

  return {
    /**
     * A presigned PUT the browser performs directly — the API never sees the
     * bytes, which is what keeps a 10 MB photo off the Node process (§12.1).
     *
     * `content-type` and `content-length` are *signed* headers, not hints: the
     * signature covers their values, so a client that asks to upload 400 KB of
     * JPEG and then sends 40 MB of something else is rejected by the object
     * store before a byte is stored. That check is the whole reason the commit
     * step can trust what it finds.
     */
    async presignPut({
      key,
      contentType,
      contentLength,
      expiresInSeconds = 300,
    }): Promise<PresignedUpload> {
      const uploadUrl = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          ContentType: contentType,
          ContentLength: contentLength,
        }),
        {
          expiresIn: expiresInSeconds,
          signableHeaders: new Set(['content-type', 'content-length']),
        },
      );

      return {
        uploadUrl,
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          // The browser sets this itself from the body it sends; naming it here
          // tells the client what the signature expects, and a mismatch fails
          // at the object store rather than silently storing the wrong length.
          'Content-Length': String(contentLength),
        },
        expiresInSeconds,
      };
    },

    async head(key): Promise<StoredObject | null> {
      try {
        const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return {
          bytes: result.ContentLength ?? 0,
          contentType: result.ContentType ?? 'application/octet-stream',
        };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async get(key): Promise<Buffer | null> {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!result.Body) return null;
        return Buffer.from(await result.Body.transformToByteArray());
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async put(key, body, contentType): Promise<void> {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
      );
    },

    async delete(key): Promise<void> {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },

    /**
     * Delivery goes through `MEDIA_BASE_URL`, not through the bucket.
     *
     * The bucket stays private in every environment: locally the API serves the
     * bytes, in production a Cloudflare zone sits in front of R2. Either way the
     * URL a page renders is addressed by media id and width, so the bucket
     * layout can change without invalidating a single cached page.
     */
    publicUrl(key) {
      return `${env.MEDIA_BASE_URL}/${key}`;
    },

    /** The only way a KYC document is ever served. Minutes, not hours. */
    signedReadUrl(key, expiresInSeconds) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn: expiresInSeconds,
      });
    },
  };
}

export function createS3Client(): S3Client {
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      // Guaranteed present: `env.ts` refuses to start with a non-local storage
      // driver and no keys, so the empty string is unreachable and exists only
      // to satisfy the type.
      accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? '',
    },
  });
}

/**
 * The bucket, created if this is a fresh MinIO volume.
 *
 * Called once at boot rather than per request. R2 buckets are created in the
 * Cloudflare dashboard and this is a no-op against them, but a developer who
 * has just run `docker compose up` should not have to open a console to upload
 * their first photo.
 */
export async function ensureBucket(client: S3Client = createS3Client()): Promise<void> {
  const { CreateBucketCommand, HeadBucketCommand } = await import('@aws-sdk/client-s3');

  try {
    await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
  }
}

/** S3, MinIO and R2 all answer 404 here; only the error name varies. */
function isNotFound(error: unknown): boolean {
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  const name = (error as { name?: string }).name;
  return status === 404 || name === 'NotFound' || name === 'NoSuchKey';
}

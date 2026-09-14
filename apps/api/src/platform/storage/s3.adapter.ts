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
import { awsStatusCode, errorString } from '../errors.js';

export function createS3Storage(client: S3Client = createS3Client()): StoragePort {
  const bucket = env.S3_BUCKET;

  return {
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

    publicUrl(key) {
      return `${env.MEDIA_BASE_URL}/${key}`;
    },

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
      accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? '',
    },
  });
}

export async function ensureBucket(client: S3Client = createS3Client()): Promise<void> {
  const { CreateBucketCommand, HeadBucketCommand } = await import('@aws-sdk/client-s3');

  try {
    await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
  }
}

function isNotFound(error: unknown): boolean {
  const name = errorString(error, 'name');
  return awsStatusCode(error) === 404 || name === 'NotFound' || name === 'NoSuchKey';
}

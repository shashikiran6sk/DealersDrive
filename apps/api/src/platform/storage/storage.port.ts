/**
 * The seam between the application and object storage.
 *
 * `LocalDiskStorage`, MinIO and Cloudflare R2 all implement it. No S3 concept
 * leaks through this interface — no bucket, no region, no SigV4 — which is what
 * makes the swap a one-line provider change in the container (§5.1) and an
 * environment variable everywhere else.
 *
 * `presignPut` and `signedReadUrl` are asynchronous because signing against a
 * real object store is: the local adapter is the only implementation that could
 * answer synchronously, and shaping the port around the exception would have
 * cost every caller a rewrite the day R2 arrived.
 */
export interface PresignedUpload {
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresInSeconds: number;
}

export interface StoredObject {
  bytes: number;
  contentType: string;
}

export interface StoragePort {
  /**
   * A URL the browser PUTs the bytes to directly. The API never touches image
   * bytes on the upload path. Content-type **and** content-length are baked
   * into the signature, so a client cannot upload something other than what it
   * declared (§12.1).
   */
  presignPut(input: {
    key: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds?: number;
  }): Promise<PresignedUpload>;

  /** HEAD the object after commit — verify what actually landed. */
  head(key: string): Promise<StoredObject | null>;

  get(key: string): Promise<Buffer | null>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;

  /** Public delivery URL. Never called for KYC documents — they have no route. */
  publicUrl(key: string): string;

  /**
   * Short-lived signed read. The only way a KYC document is ever served, and
   * every issue of one is audit-logged (§26.6).
   */
  signedReadUrl(key: string, expiresInSeconds: number): Promise<string>;
}

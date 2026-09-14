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
  presignPut(input: {
    key: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds?: number;
  }): Promise<PresignedUpload>;

  head(key: string): Promise<StoredObject | null>;

  get(key: string): Promise<Buffer | null>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;

  publicUrl(key: string): string;

  signedReadUrl(key: string, expiresInSeconds: number): Promise<string>;
}

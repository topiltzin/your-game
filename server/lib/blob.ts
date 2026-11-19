// Private object storage on Cloudflare R2 (S3-compatible API). Uploaded inputs and generated
// models live here; nothing is public. Credentials come from env and are never logged.
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export interface BlobStore {
  putPrivate(pathname: string, bytes: Uint8Array, contentType: string): Promise<void>;
  getPrivate(pathname: string): Promise<Uint8Array | null>;
  deletePrivate(pathname: string): Promise<void>;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function createBlobStore(): BlobStore {
  const bucket = required("R2_BUCKET");
  const client = new S3Client({
    region: "auto",
    endpoint: required("R2_ENDPOINT_URL"),
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
  });

  return {
    async putPrivate(pathname, bytes, contentType) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: pathname, Body: bytes, ContentType: contentType }),
      );
    },

    async getPrivate(pathname) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: pathname }));
        if (!result.Body) return null;
        return await result.Body.transformToByteArray();
      } catch (error) {
        if (error instanceof Error && (error.name === "NoSuchKey" || error.name === "NotFound")) return null;
        throw error;
      }
    },

    async deletePrivate(pathname) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: pathname }));
    },
  };
}

// Private object storage in the shared Supabase project (Storage bucket SKETCH_BUCKET, created by
// supabase/migrations/0002_create_sketch_bucket.sql). Uploaded inputs and generated models live
// here; the bucket is private and only the server (secret key) reads or writes it.
import { createSupabase } from "./db.js";

export const SKETCH_BUCKET = "sketch-runner";

export interface BlobStore {
  putPrivate(pathname: string, bytes: Uint8Array, contentType: string): Promise<void>;
  getPrivate(pathname: string): Promise<Uint8Array | null>;
  deletePrivate(pathname: string): Promise<void>;
}

/** Storage reports a missing object as a 404 (statusCode "404" or a "not found" message). */
export function isNotFound(error: { statusCode?: string; message?: string }): boolean {
  return error.statusCode === "404" || /not found/i.test(error.message ?? "");
}

export function createBlobStore(): BlobStore {
  const bucket = createSupabase().storage.from(SKETCH_BUCKET);

  return {
    async putPrivate(pathname, bytes, contentType) {
      const { error } = await bucket.upload(pathname, bytes, { contentType, upsert: false });
      if (error) throw new Error(`storage upload failed: ${error.message}`);
    },

    async getPrivate(pathname) {
      const { data, error } = await bucket.download(pathname);
      if (error) {
        if (isNotFound(error)) return null;
        throw new Error(`storage download failed: ${error.message}`);
      }
      return new Uint8Array(await data.arrayBuffer());
    },

    async deletePrivate(pathname) {
      const { error } = await bucket.remove([pathname]);
      if (error) throw new Error(`storage delete failed: ${error.message}`);
    },
  };
}

// Production adapters for the create-model pipeline: database, private Blob, and the 3D service.
import { createJobRepository, createSupabase } from "../server/lib/db.js";
import { createBlobStore } from "../server/lib/blob.js";
import type { CreateModelDeps } from "./create-model-core.js";
import { callImageTo3d } from "./sf3d-client.js";

export function createProductionDeps(): CreateModelDeps {
  const repo = createJobRepository(createSupabase());
  const blob = createBlobStore();
  const endpoint = process.env["SF3D_API_URL"];
  if (!endpoint) throw new Error("SF3D_API_URL is not set");

  return {
    now: () => new Date(),
    markProcessing: (jobId) => repo.update(jobId, ["queued"], { status: "processing" }),
    async readInput(inputKey) {
      const bytes = await blob.getPrivate(inputKey);
      if (!bytes) throw new Error("input missing");
      return bytes;
    },
    // The browser downscales and orients the image before upload (see contracts/api.md), so no
    // server-side image processing is needed.
    prepareImage: async (bytes) => bytes,
    generateModel: (image, textureResolution, timeoutMs) =>
      callImageTo3d(image, textureResolution, { endpoint, timeoutMs }),
    async storeModel(jobId, bytes) {
      const key = `models/${jobId}.glb`;
      await blob.putPrivate(key, bytes, "model/gltf-binary");
      return key;
    },
    markReady: (jobId, modelKey) => repo.update(jobId, ["processing"], { status: "ready", modelKey }),
    markTerminal: (jobId, status, reason) =>
      repo.update(jobId, ["queued", "processing"], { status, failureReason: reason }),
    discardModel: (key) => blob.deletePrivate(key),
    deleteInput: (key) => blob.deletePrivate(key),
  };
}

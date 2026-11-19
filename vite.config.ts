import { defineConfig, loadEnv, type Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";

// The 3D viewer is kept out of the entry chunk: it is imported lazily on the first 3D view
// (see src/character/model-viewer.ts), so the game loads without it.
export default defineConfig({
  plugins: [localApiPlugin()],
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@google/model-viewer") || id.includes("three")) return "model-viewer";
          if (id.includes("heic-to")) return "heic";
          return undefined;
        },
      },
    },
  },
});

interface ApiRoute {
  readonly pattern: RegExp;
  /** Module under api/ that exports one handler per HTTP method. */
  readonly file: string;
}

// Mirrors the Vercel file routes in api/. Vite serves only the front end, so these run in dev.
const API_ROUTES: readonly ApiRoute[] = [
  { pattern: /^\/api\/uploads\/?$/, file: "/api/uploads/index.ts" },
  { pattern: /^\/api\/jobs\/?$/, file: "/api/jobs/index.ts" },
  { pattern: /^\/api\/jobs\/[^/]+\/?$/, file: "/api/jobs/[id].ts" },
  { pattern: /^\/api\/models\/.+/, file: "/api/models/[...key].ts" },
];

type WebHandler = (request: Request) => Promise<Response>;

/**
 * Dev-only: serves the api/ handlers from the Vite dev server, so the browser's /api calls reach
 * the job API instead of Vite's 404. Handler exceptions are logged here with their stack.
 */
function localApiPlugin(): Plugin {
  return {
    name: "local-api",
    apply: "serve",
    configureServer(server) {
      // Vite exposes .env.local only as import.meta.env. The API reads process.env (as Vercel does),
      // so copy every value that is not already set in the shell.
      const fileEnv = loadEnv(server.config.mode, server.config.root, "");
      for (const [key, value] of Object.entries(fileEnv)) process.env[key] ??= value;

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const route = API_ROUTES.find((candidate) => candidate.pattern.test(url.pathname));
        if (!route) return next();
        try {
          const handlers = (await server.ssrLoadModule(route.file)) as Record<string, WebHandler>;
          const handler = handlers[req.method ?? "GET"];
          if (!handler) {
            return sendJson(res, 405, envelopeError("METHOD_NOT_ALLOWED", "Method not allowed.", false));
          }
          await sendWebResponse(res, await handler(toWebRequest(req)));
        } catch (error) {
          server.config.logger.error(`[local-api] ${req.method} ${url.pathname} failed:\n${formatError(error)}`);
          sendJson(res, 500, envelopeError("INTERNAL", "Something went wrong. Try again.", true));
        }
      });
    },
  };
}

function toWebRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? "localhost";
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  return new Request(`http://${host}${req.url ?? "/"}`, {
    method: req.method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as unknown as ReadableStream) : undefined,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

async function sendWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function envelopeError(code: string, message: string, retryable: boolean) {
  return { ok: false, data: null, error: { code, message, retryable } };
}

function formatError(error: unknown): string {
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}

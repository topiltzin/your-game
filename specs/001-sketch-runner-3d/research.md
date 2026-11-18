# Phase 0 Research: Sketch Runner

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-18

Every NEEDS CLARIFICATION from the plan is resolved below. The spec's only open question (FR-008) was answered as option B.

## 1. What "3D" means in the runner

- **Decision**: 2D side-scroller; in 3D mode the character is shown as its rendered 3D model. Gameplay rules are identical in both modes.
- **Rationale**: Chosen by the user (option B). Keeps gap and shape rules unchanged and avoids a 3D world.
- **Alternatives considered**: A 3D perspective runner (rejected: much larger scope, changes gap rules); 3D preview only (rejected: the 3D choice would change nothing in play).

## 2. 3D creation approach

- **Decision**: Reuse emi_crafting's asynchronous image-to-3D job pattern: create a job, call an external image-to-3D service that returns a model file, store it, mark the job ready; the client polls. Service endpoint configurable so it can be replaced.
- **Rationale**: Same service the user already uses and tested; the job pattern handles the slow third-party call and the 10-minute timeout.
- **Alternatives considered**: Synchronous request from the browser (rejected: exceeds request limits and cannot resume after reconnect); self-hosted model (rejected for v1: GPU cost and ops).
- **Risk**: The external service is free, third-party, and may sleep or change API (emi_crafting's worker README documents this). Mitigation: FR-010 2D fallback, configurable endpoint, clear user messaging.

## 3. Where the external call runs

- **Decision**: A durable Vercel Workflow per job (`workflows/create-model.ts`) performs prepare → call service → store → mark ready, with the 10-minute deadline enforced in the workflow.
- **Rationale**: Survives function restarts and retries; no always-on server.
- **Alternatives considered**: emi_crafting-style always-on Python worker polling a database (rejected: needs a server to run; contradicts serverless target). Cron poller over `model_jobs` (kept as fallback if the workflow cannot hold the external call; same contract).
- **Verification needed at implementation**: Confirm current Workflow API against the installed package docs (`vercel:workflow` skill) before writing the workflow.

## 4. Relational store

- **Decision**: Neon Postgres provisioned through the Vercel Marketplace (`neon` integration). Holds `model_jobs` only.
- **Rationale**: The Marketplace is the recommended path for databases (Vercel Postgres and KV are no longer offered). Discovery returned these Postgres options: Neon, Supabase, Prisma Postgres, Amazon Aurora PostgreSQL, Nile.
- **Alternatives considered**: Supabase (also fine; emi_crafting already uses it, but a separate project keeps this app standalone per spec assumptions); Turso (SQLite; viable but Postgres matches the atomic-claim needs).
- **Action at implementation**: Run `vercel integration guide neon --framework vite` and follow the guide after user confirmation.

## 5. File storage

- **Decision**: Cloudflare R2, private store. Uploaded images and generated model files stored privately; model files served to the client through a short-lived signed URL from a function.
- **Rationale**: Native to the platform; R2 private buckets are standard.
- **Alternatives considered**: Amazon S3 via the Marketplace (available; more setup, same outcome); Supabase Storage (ties to the emi_crafting project; rejected for standalone scope).

## 6. Client framework

- **Decision**: Vanilla TypeScript with Vite; no UI framework.
- **Rationale**: Five screens and one canvas. A framework adds bundle weight and re-render cost with no benefit; the game loop must stay outside any render cycle (taste skill rule against state-driven motion).
- **Alternatives considered**: React + Motion (rejected: heavier; the design skill's React patterns target landing pages); Phaser (rejected: a full engine for a simple runner; large bundle).

## 7. Game rendering and loop

- **Decision**: Canvas 2D, fixed-timestep update at 60 Hz with interpolated render; physics and obstacle logic are pure functions with no DOM access.
- **Rationale**: Deterministic and unit-testable; meets the 100 ms input response and 55+ fps targets on mid-range phones.
- **Alternatives considered**: WebGL for the 2D runner (rejected: unnecessary complexity); DOM-based sprites (rejected: poor frame-rate control for particles).

## 8. Silhouette and hitbox from a drawing

- **Decision**: Client-side. Flatten to a canvas, treat near-white or transparent pixels as background, take the largest connected non-background component, compute its bounding box, and normalize height and width to the game's character scale (`config.ts`). Apply the size cap (FR-021) when the normalized size exceeds limits. Show the outline preview before the run (FR-003).
- **Rationale**: No upload needed for gameplay; deterministic; testable with fixture images.
- **Alternatives considered**: Server-side segmentation model (rejected for v1: cost and latency); alpha-only (rejected: most drawings are opaque white paper).

## 9. Collision rules from shape

- **Decision**: Use the bounding-box height for overhead barriers (slide required when `characterHeight > clearance`) and the bounding-box width for pinch gaps (blocked when `characterWidth > gapWidth`). Ground gaps depend only on jump timing.
- **Rationale**: Matches the user's rule ("tall may need to duck more") and the spec's FR-016/FR-017; a bounding box is simple and predictable for players.
- **Alternatives considered**: Per-pixel collision (rejected: unpredictable for players, costly).

## 10. HEIC support

- **Decision**: Lazy-load `heic-to` only when a HEIC file is selected.
- **Rationale**: Same library emi_crafting uses; Chrome lacks native HEIC decoding; keeps the initial bundle small.

## 11. Abuse, cost, and privacy

- **Decision**: Per-IP rate limit on job creation; one active job per character; magic-byte check on uploads; FR-007 disclosure before upload; images in a private R2 bucket and deleted after the model is produced or after 24 hours if the job fails.
- **Rationale**: Protects the free third-party service and platform cost; the spec's privacy requirement.
- **Alternatives considered**: Accounts (rejected: out of scope, FR-026 "no account required").

## 12. Design system and fonts

- **Decision**: Custom token set (see plan's Design Direction). Fonts self-hosted with `font-display: swap`; no Google Fonts `<link>` in production.
- **Rationale**: Taste skill rules (no Inter default, no serif default, self-hosted fonts).
- **Alternatives considered**: Radix or shadcn (rejected: built for product UI; the game screens need custom character); a published game UI kit (none fit the sketch aesthetic).

## 13. Testing approach

- **Decision**: Vitest for unit and API tests (80% coverage target); Playwright for end-to-end flows including the 3D-failure fallback and reduced-motion mode; visual snapshots for mode-select and summary screens.
- **Rationale**: Project testing rules; game logic is pure, so most behavior is unit-testable.

## 14. Tooling note

- The Vercel CLI installed here is 62.2.0; the latest is 66.2.0. Upgrade before running `vercel link` or `vercel integration add` (`npm i -g vercel@latest`).
- The project is not yet linked to a Vercel project (`.vercel/project.json` missing). Linking and provisioning happen at implementation time after the user confirms.

## Open items

None blocking. Items to verify during implementation: the current Workflow API (`vercel:workflow`), the Neon guide output, and the external service's current endpoint and response format.

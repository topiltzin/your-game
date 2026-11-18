# Implementation Plan: Sketch Runner — Draw Your Character

**Branch**: `001-sketch-runner-3d` (no git repository; branch not created) | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-sketch-runner-3d/spec.md`

## Summary

A web game where the player uploads or draws a character, the character is turned into a 3D model by an asynchronous job, and the player then picks a 2D or 3D presentation and plays Sketch Runner. The runner is a 2D side-scroller: the character runs automatically, tap or click jumps, swipe or down-arrow slides. Collisions use the drawing's silhouette, so a tall character must slide under overhead barriers that a short one can run under, and a wide character cannot squeeze through pinch gaps.

Technical approach (details in [research.md](research.md)):

- **Client**: Vite + TypeScript single-page app. Canvas 2D for the game loop and effects; DOM screens with CSS transitions and the Web Animations API for UI motion. `@google/model-viewer` for the 3D preview, lazy-loaded (same library emi_crafting uses).
- **Silhouette**: computed in the browser from the drawing, no server round trip.
- **3D creation**: the browser uploads the prepared image; a Vercel Function creates a job row and starts a durable Vercel Workflow that calls the same external image-to-3D service emi_crafting uses, stores the returned model in R2, and marks the job ready. The client polls the job. A 10-minute timeout is enforced by the workflow.
- **Persistence**: Neon Postgres (via Vercel Marketplace) holds job rows only. Images and models live in Cloudflare R2. Best score stays on the device.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 24 LTS for server functions

**Primary Dependencies**: Vite (client build), `@google/model-viewer` (3D preview, lazy), `heic-to` (HEIC decoding in browsers without native support, same library as emi_crafting), Vercel Workflow (durable 3D job), Cloudflare R2 via `@aws-sdk/client-s3` (private file storage, S3-compatible), Neon serverless Postgres driver (`@neondatabase/serverless`, installed via the Marketplace integration guide)

**Storage**: Neon Postgres (`model_jobs` table only); Cloudflare R2 (private bucket: uploaded images, generated model files); browser `localStorage` (best distance, job token for resume)

**Testing**: Vitest (unit + API integration with a test database), Playwright (end-to-end flows and visual checks), coverage target 80% (project testing rule)

**Target Platform**: Current mobile and desktop browsers (Chromium, Safari iOS 16+, Firefox). WebGL needed only for the 3D preview.

**Project Type**: Web application: static client plus serverless API and one durable workflow

**Performance Goals**: Jump/slide visible within 100 ms (SC-003); 55+ fps on mid-range phones during play (SC-007); LCP < 2.5 s on the first screen; game code loaded separately from the 3D viewer

**Constraints**: Upload max 10 MB (FR-002); 3D job timeout 10 min (FR-005); reduced-motion honored (FR-025); no accounts; images leave the device only after the disclosure in FR-007; the external 3D service is third-party and may be slow or down (FR-010 fallback)

**Scale/Scope**: Single-player casual game; expect low hundreds of concurrent players at launch. Per-IP rate limit on job creation to protect the free third-party service and cost. One active job per character.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (placeholder principles), so there are no project-specific principles to enforce. Gates therefore pass vacuously. Recommended follow-up: run `/speckit-constitution` to record real principles.

Project-level rules that apply regardless (from the user's global rules) and are built into this plan:

- TDD: tests written before implementation for game physics, silhouette, and API handlers.
- Coverage target 80%.
- Files kept under the 800-line soft ceiling; functions under 50 lines.
- Errors handled explicitly at API boundaries; no secrets in source (env vars via Vercel).
- Rate limiting on the job-creation endpoint.

**Result**: PASS (no principles violated; constitution gap noted).

## Design Direction (applied to all UI)

Source: `design-taste-frontend` and `emil-design-eng` skills, adapted to a game (the landing-page rules such as hero stack limits do not apply).

- **Read**: playful, hand-drawn, attractive game for a casual audience. Medium-high motion (MOTION_INTENSITY 7 for the game screens, 4 for the menus), variance 6, density 2.
- **Type**: sans display with character (e.g. Bricolage Grotesque) plus a hand-drawn accent face only for one word per screen. Not Inter, not a serif (taste rules).
- **Color**: one accent (tomato red) on a paper-white ground with ink near-black text. Dark mode is an ink background with the same accent. One palette locked for the whole app.
- **Shapes**: one radius system (pill for buttons, 20px for cards). Character frame uses a sketched, slightly wobbly border.
- **Copy**: no em-dashes anywhere in visible text (taste rule). No scroll cues, no emoji, no version labels.
- **Icons**: one family (Phosphor), one stroke width.
- **Motion rules (Emil)**: animate only transform and opacity; UI transitions 150-300 ms with strong ease-out; never `transition: all`; buttons scale to 0.97 on press; enter animations start at scale 0.95 with opacity, never from 0; keyboard-triggered actions get no UI animation; reduced motion replaces movement with fades.
- **Game effects**: dust puffs on takeoff and landing, slide trail, ink-splat particles on crash, score pop, parallax layers; all effects gated by reduced-motion.

## Project Structure

### Documentation (this feature)

```text
specs/001-sketch-runner-3d/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities and rules
├── quickstart.md        # Phase 1 validation guide
├── contracts/
│   ├── api.md           # HTTP contract for character jobs
│   └── game-rules.md    # Gameplay rules and tuning constants
├── checklists/
│   └── requirements.md
└── tasks.md             # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
index.html
vite.config.ts
package.json
tsconfig.json
vercel.json                  # or vercel.ts per current Vercel guidance

src/
├── main.ts                  # App bootstrap, screen router
├── styles/
│   ├── tokens.css           # Colors, type, radii, durations (single source)
│   ├── screens.css          # Screen layouts and transitions
│   └── motion.css           # Reduced-motion overrides
├── screens/
│   ├── upload-screen.ts     # Upload + drop zone
│   ├── draw-screen.ts       # Drawing canvas
│   ├── processing-screen.ts # Animated progress, cancel/retry
│   ├── mode-screen.ts       # 2D/3D choice with live previews
│   ├── run-screen.ts        # Mounts the game canvas + HUD
│   └── summary-screen.ts    # Distance, best score
├── character/
│   ├── image-input.ts       # Validate type/size; HEIC decode (lazy)
│   ├── silhouette.ts        # Background removal, outline, bounding box
│   ├── size-cap.ts          # FR-021 cap and message
│   └── model-viewer.ts      # Lazy import of @google/model-viewer
├── game/
│   ├── config.ts            # Tuning constants (see contracts/game-rules.md)
│   ├── loop.ts              # Fixed-timestep loop, pause on hidden
│   ├── physics.ts           # Gravity, jump, slide state machine
│   ├── collision.ts         # AABB and silhouette-derived hitbox rules
│   ├── obstacles.ts         # Procedural generator (ground, overhead, pinch)
│   ├── input.ts             # Tap/click, swipe, keyboard
│   ├── renderer.ts          # Canvas drawing of character, obstacles, background
│   ├── effects/
│   │   ├── particles.ts     # Dust, trail, ink splat pools
│   │   └── parallax.ts      # Layered background
│   └── best-score.ts        # localStorage wrapper with try/catch
├── api/
│   └── client.ts            # fetch wrappers for contracts/api.md
└── ui/
    ├── transitions.ts       # Screen enter/exit via WAAPI
    └── reduced-motion.ts    # Media query store

api/                         # Vercel Functions
├── characters/
│   └── index.ts             # POST multipart image upload to R2
├── jobs/
│   ├── index.ts             # POST create job (rate-limited)
│   └── [id].ts              # GET job status; DELETE cancel
└── lib/
    ├── db.ts                # Neon client, model_jobs queries
    ├── blob.ts              # Private R2 read/write
    ├── rate-limit.ts        # Per-IP window
    ├── image-check.ts       # Magic-byte validation
    └── errors.ts            # Error envelope

workflows/
└── create-model.ts          # Durable: prepare image, call 3D service, store, timeout

tests/
├── unit/                    # physics, collision, silhouette, obstacles, size-cap
├── api/                     # handlers with test DB
└── e2e/                     # Playwright: upload→mode→run; 3D failure fallback
```

**Structure Decision**: Single repository, one Vite client app plus Vercel Functions under `api/` and one durable workflow under `workflows/`. The client stays framework-free (no React) because the app is five screens plus a canvas; this keeps the game loop simple and the bundle small. Game logic is pure TypeScript with no DOM access, so it can be unit-tested without a browser.

## Complexity Tracking

No constitution violations to justify. One deliberate choice worth recording: a durable workflow is used instead of an emi_crafting-style always-on worker, because the app is serverless and jobs must survive function restarts. If the durable workflow proves unsuitable for the 10-minute external call, fall back to a cron-driven poller over `model_jobs` (same contract).

| Choice | Why | Simpler alternative rejected because |
|---|---|---|
| Durable workflow for jobs | Survives restarts, enforces 10-min timeout, resumable | Plain function call times out on long external calls |
| Neon Postgres for job rows | Small relational state with atomic status changes | Storage-only state cannot do atomic claim/cancel |

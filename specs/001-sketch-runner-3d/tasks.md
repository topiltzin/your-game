# Tasks: Sketch Runner — Draw Your Character

**Input**: Design documents from `/specs/001-sketch-runner-3d/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/ (api.md, game-rules.md), quickstart.md

**Tests**: Included. The project's global rules require TDD (tests written first, seen to fail, then implementation) and 80% coverage, and plan.md names Vitest and Playwright. Each story's test tasks come before its implementation tasks.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and delivered independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 through US5, from spec.md
- Exact file paths are in every description

## Path Conventions

Single repository: client in `src/`, Vercel Functions in `api/`, durable workflow in `workflows/`, DB migrations in `db/`, tests in `tests/`.

**Plan correction**: plan.md listed the upload route as `api/characters/index.ts`. The API contract (`contracts/api.md`) defines `POST /api/uploads`, so this file uses `api/uploads/index.ts`. Update plan.md to match.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and tooling

- [X] T001 Create `package.json` (name `sketch-runner`, `"type": "module"`, scripts: `dev`, `build`, `test`, `test:api`, `test:e2e`, `coverage`, `db:migrate`) at `package.json`
- [X] T002 Create strict TypeScript config (`"strict": true`, `"noUncheckedIndexedAccess": true`) at `tsconfig.json`
- [X] T003 Create Vite config with a separate chunk for the 3D viewer (`@google/model-viewer` must not load on the first screen) at `vite.config.ts`
- [X] T004 Create the HTML shell with a `<main id="app">` root and a skip link, no external font `<link>` tags, at `index.html`
- [X] T005 Install runtime dependencies `@google/model-viewer`, `heic-to`, `@aws-sdk/client-s3` (R2), `@neondatabase/serverless`, and the Workflow package named by the `vercel:workflow` skill, via `npm install` (versions verified against installed package docs before pinning)
- [X] T006 Install dev dependencies `typescript`, `vitest`, `@vitest/coverage-v8`, `@playwright/test`, `eslint`, `prettier` via `npm install -D`
- [ ] T007 [P] Create Vercel project config with function settings for `api/**` and the workflow, and a daily cron entry for cleanup, at `vercel.json` (or `vercel.ts` if the current Vercel guidance requires it)
- [X] T008 [P] Create env template listing `DATABASE_URL`, `DATABASE_URL`, `R2_*` storage keys, `SF3D_API_URL` (no real values), at `.env.example`
- [X] T009 [P] Create ignore rules for `.env.local`, `.vercel/`, `dist/`, `coverage/`, `node_modules/` at `.gitignore`
- [X] T010 [P] Create Vitest config (jsdom for `tests/unit`, node for `tests/api`, 80% coverage threshold) at `vitest.config.ts`
- [X] T011 [P] Create Playwright config (Chromium desktop, iPhone-size viewport, `reducedMotion` project variant) at `playwright.config.ts`
- [ ] T012 [P] Create ESLint config for TypeScript with a rule that forbids `window.addEventListener('scroll'` and `transition: all` in CSS checks, at `eslint.config.js`

**Checkpoint**: `npm run build` and `npm run test` both run (empty suites pass).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared pieces every story needs. No user story work starts until this phase is done.

**CRITICAL**: No user story work can begin until this phase is complete.

### Shared constants and tokens

- [X] T013 [P] Write failing test that every constant in `contracts/game-rules.md` "Constants" table exists with the documented value in `tests/unit/config.test.ts`
- [X] T014 Implement `src/game/config.ts` with every constant from the `contracts/game-rules.md` table (`TICK_HZ` 60, `GRAVITY` 2600, `JUMP_VELOCITY` 980, `SLIDE_DURATION` 0.65, `SLIDE_HEIGHT_FACTOR` 0.45, `START_SPEED` 360, `MAX_SPEED` 820, `SPEED_RAMP_PER_SECOND` 9, `CHARACTER_HEIGHT_MIN/MAX` 90/260, `CHARACTER_WIDTH_MIN/MAX` 60/200, `CHARACTER_BASE_HEIGHT` 150, `INPUT_LATENCY_TARGET_MS` 100)
- [ ] T015 [P] Create design tokens (single source): paper-white ground, ink text, one tomato-red accent, pill buttons (radius 999px), card radius 20px, durations 150/220/300 ms, strong ease-out `cubic-bezier(0.23, 1, 0.32, 1)` at `src/styles/tokens.css`
- [ ] T016 [P] Create reduced-motion overrides: under `prefers-reduced-motion: reduce`, remove transforms on screens and cards, keep opacity fades, at `src/styles/motion.css`
- [ ] T017 Write failing test for the reduced-motion store (reads `matchMedia`, falls back to `false` if `matchMedia` throws) in `tests/unit/reduced-motion.test.ts`
- [X] T018 Implement reduced-motion store with try/catch around `matchMedia` at `src/ui/reduced-motion.ts`
- [X] T019 [P] Create seeded RNG (mulberry32) used by the obstacle generator and tests at `src/game/rng.ts`

### Transitions and screen routing

- [X] T020 [P] Create WAAPI screen transition helper (enter from `scale(0.95)` + opacity; exit in 150 ms; no `transition: all`; reduced-motion switches to fade only) at `src/ui/transitions.ts`
- [X] T021 Create screen router with `show(name)` and a single active screen at `src/main.ts`

### Client API envelope

- [X] T022 [P] Write failing test that the client parses both success and error envelopes from `contracts/api.md` "Conventions" in `tests/unit/api-envelope.test.ts`
- [X] T023 Implement envelope types and parser (`ok`, `data`, `error`; throws a typed error with `code`, `message`, `retryable`) at `src/api/envelope.ts`

### Server foundations

- [ ] T024 [P] Write failing test that every error code in `contracts/api.md` "Error codes" maps to its documented HTTP status and fixed player message in `tests/api/errors.test.ts`
- [X] T025 Implement error envelope helpers and the code→status→message table from `contracts/api.md` at `api/lib/errors.ts`
- [X] T026 Create the migration for `model_jobs`: `id uuid PK`, `access_token_hash text not null` (SHA-256 of token, only hash stored), `status` enum exactly `queued | processing | ready | failed | timed_out | cancelled` with default `queued`, `input_key text not null`, `model_key text null` (set only when `ready`), `failure_reason text null` (fixed-list text only), `requested_at timestamptz not null`, `updated_at timestamptz not null`, `ip_hash text not null` (hash, not raw IP), plus indexes `(status, requested_at)` and `(ip_hash, requested_at)`, at `db/migrations/0001_create_model_jobs.sql`
- [X] T027 Create database client (Neon serverless driver, reads `DATABASE_URL`, throws a clear error at startup if missing) at `api/lib/db.ts`
- [X] T028 [P] Create migration runner script at `db/migrate.ts`
- [ ] T029 Write failing test for job tokens: 256-bit random, base64url, SHA-256 hash stored, constant-time compare in `tests/unit/job-token.test.ts`
- [X] T030 Implement job token helpers at `api/lib/job-token.ts`
- [ ] T031 [P] Write failing test for rate limit: 5 creations per IP hash per rolling hour, 6th returns `RATE_LIMITED` in `tests/api/rate-limit.test.ts`
- [X] T032 Implement per-IP-hash rate limit using `model_jobs` rows (no raw IP stored) at `api/lib/rate-limit.ts`
- [X] T033 [P] Implement private Blob helpers (put, read stream, short-lived signed URL with 15-minute TTL, delete) at `api/lib/blob.ts`

**Checkpoint**: Foundation ready. Stories can start in parallel if staffed.

---

## Phase 3: User Story 1 - Turn a Drawing into a Character (Priority: P1)

**Goal**: Player uploads or draws a character, sees its outline, accepts the disclosure, and gets a 3D model through an async job with progress, cancel/retry, timeout, and a rotatable preview.

**Independent Test**: Upload one JPEG (or draw one), confirm the outline, accept disclosure, wait for `ready`, rotate the 3D preview. Quickstart Scenarios 1 and 2.

### Tests for User Story 1 (write first, must fail)

- [X] T034 [P] [US1] Write failing silhouette tests: blank image returns `CHARACTER_UNREADABLE`; fewer than 500 foreground pixels returns `CHARACTER_UNREADABLE`; largest connected component is kept; components under 2% of its area are dropped; bounding box matches fixture, in `tests/unit/silhouette.test.ts`
- [X] T035 [P] [US1] Write failing size-cap tests: clamp to `CHARACTER_HEIGHT_MIN`–`MAX` and `CHARACTER_WIDTH_MIN`–`MAX` keeping aspect ratio; `sizeCapped` true only when a value changed, in `tests/unit/size-cap.test.ts`
- [X] T036 [P] [US1] Write failing magic-byte tests: JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), WebP (`RIFF....WEBP`) accepted; other bytes return `IMAGE_INVALID`, in `tests/api/image-check.test.ts`
- [X] T037 [P] [US1] Write failing client file-validation tests: types outside `image/jpeg|image/png|image/webp|image/heic` return `IMAGE_TYPE_UNSUPPORTED`; size over 10 MB returns `IMAGE_TOO_LARGE`, in `tests/unit/image-input.test.ts`
- [ ] T038 [P] [US1] Write failing API tests for `POST /api/uploads` in `tests/api/uploads.test.ts`: `contentType` restricted to `image/jpeg`, `image/png`, `image/webp`; `byteSize` over 10 MB rejected with `IMAGE_TOO_LARGE`; response has `uploadUrl`, `inputKey`, `expiresAt`
- [X] T039 [P] [US1] Write failing API tests for `POST /api/jobs` in `tests/api/jobs-create.test.ts`: `disclosureAccepted: false` returns `DISCLOSURE_REQUIRED`; `textureResolution` outside {512, 1024} rejected; 201 returns job with `status: queued`, `deadlineAt` = `requestedAt` + 10 min, and an `accessToken`; second active job for same `inputKey` returns `JOB_ALREADY_ACTIVE`
- [X] T040 [P] [US1] Write failing API tests for `GET /api/jobs/{id}` and `DELETE /api/jobs/{id}` in `tests/api/jobs-status.test.ts`: wrong token returns `JOB_NOT_FOUND` (same as missing job); `ready` includes `modelUrl` signed for 15 min; `failed` and `timed_out` include `failure`; past `deadlineAt` on a non-terminal job lazily becomes `timed_out`; DELETE cancels `queued` and `processing`, is idempotent, and leaves terminal jobs unchanged
- [X] T041 [P] [US1] Write failing workflow tests in `tests/api/workflow-create-model.test.ts`: conditional transitions (`queued→processing→ready`); cancelled job discards stored model; service error maps to `failed` with fixed reason and no raw upstream text; input deleted on `ready`
- [ ] T042 [P] [US1] Write failing Playwright test for Scenarios 1 and 2 (upload, outline, disclosure gate, processing, preview) in `tests/e2e/upload-to-preview.spec.ts`

### Implementation for User Story 1

- [X] T043 [P] [US1] Implement image magic-byte check at `api/lib/image-check.ts`
- [X] T044 [P] [US1] Implement client image input validation (type, 10 MB limit) with lazy HEIC decode via `heic-to` only when a HEIC file is chosen, at `src/character/image-input.ts`
- [X] T045 [US1] Implement silhouette extraction (flatten onto white; foreground when alpha > 0.5 and luminance < 0.9; largest 8-connected component; drop components under 2% of its area; `CHARACTER_UNREADABLE` under 500 pixels) at `src/character/silhouette.ts`
- [X] T046 [P] [US1] Implement size clamp and `sizeCapped` flag at `src/character/size-cap.ts`
- [ ] T047 [US1] Implement the `Character` in-memory type per data-model.md (`sourceKind`, `silhouette`, `heightUnits`, `widthUnits`, `sizeCapped`, `sketchImage`, `jobId`, `modelStatus`, `presentation` default `2d`) at `src/character/character.ts`
- [X] T048 [US1] Implement `POST /api/uploads` (validate `contentType` and `byteSize` ≤ 10 MB; return private upload target with `inputKey`) at `api/uploads/index.ts`
- [X] T049 [US1] Implement `POST /api/jobs` (validate `disclosureAccepted` and `textureResolution`; apply rate limit; enforce one active job per `inputKey`; insert `model_jobs` row with hashed token; start the durable workflow; return 201 with token) at `api/jobs/index.ts`
- [X] T050 [US1] Implement `GET /api/jobs/[id]` (token check; lazy timeout using `deadlineAt`; signed `modelUrl` only when `ready`; `failure` for `failed`/`timed_out`) and `DELETE /api/jobs/[id]` (idempotent cancel) at `api/jobs/[id].ts`
- [X] T051 [US1] Implement the durable workflow (`queued→processing`, fetch input, normalize orientation and downscale, call external service, store model, conditional `processing→ready`, discard result if already cancelled or timed out, delete input on `ready`) at `workflows/create-model.ts`
- [X] T052 [P] [US1] Implement external image-to-3D client (endpoint from `SF3D_API_URL`; single call bounded by time remaining before `deadlineAt`; maps service errors to fixed reasons) at `workflows/sf3d-client.ts`
- [X] T053 [P] [US1] Implement client API wrappers for `POST /api/uploads`, `POST /api/jobs`, `GET`/`DELETE /api/jobs/{id}` with bearer token header at `src/api/client.ts`
- [X] T054 [P] [US1] Implement job session storage: save and read `sketchRunner.jobToken:{jobId}` in `localStorage` inside try/catch; clear when job is terminal, at `src/character/job-session.ts`
- [X] T055 [US1] Implement upload screen: file picker and drop zone, unsupported-type and oversize messages, outline preview, disclosure checkbox that gates the create button (FR-007), at `src/screens/upload-screen.ts`
- [X] T056 [US1] Implement draw screen: canvas with mouse, touch, and pen pointer events; clear and confirm actions; converts canvas to an image for the same flow, at `src/screens/draw-screen.ts`
- [X] T057 [US1] Implement processing screen: animated progress (no frozen state), polling every 5 s backing off to 10 s, Cancel button, retry on `failed`/`timed_out`, resume from stored token after reload, at `src/screens/processing-screen.ts`
- [X] T058 [P] [US1] Implement lazy `@google/model-viewer` loader (dynamic import only on first 3D view; retry on chunk-load failure) at `src/character/model-viewer.ts`
- [ ] T059 [US1] Implement 3D preview component: rotate and zoom, shown after `ready`, at `src/screens/model-preview.ts`
- [X] T060 [US1] Wire upload, draw, processing, and preview into the screen router so the flow goes upload/draw → processing → preview → (mode screen placeholder) in `src/main.ts`

**Checkpoint**: US1 works alone. Quickstart Scenarios 1 and 2 pass.

---

## Phase 4: User Story 2 - Run Sketch Runner (Priority: P1)

**Goal**: The character runs automatically; tap or click (or Space/Up) jumps; swipe down (or Down) slides; obstacles follow the tall/wide rules; crash shows a summary.

**Independent Test**: With a fixture character (no 3D job needed), play a run: jump over a ground gap, slide under an overhead barrier, and confirm the tall-character rule. Quickstart Scenarios 3 and 4.

### Tests for User Story 2 (write first, must fail)

- [X] T061 [P] [US2] Create character fixtures (tall narrow, short wide, standard) at `tests/fixtures/characters.ts`
- [X] T062 [P] [US2] Write failing physics tests: jump from standing lands after the airtime implied by `GRAVITY` and `JUMP_VELOCITY`; jump from sliding is rejected; slide lasts `SLIDE_DURATION` then stands; tap during slide is buffered at most 0.1 s then discarded, in `tests/unit/physics.test.ts`
- [X] T063 [P] [US2] Write failing collision tests (game-rules oracle 1–3): standing with `H ≤ clearance` passes overhead, `H > clearance` crashes; sliding with `H_s ≤ clearance` passes where a taller standing character cannot; `W > gapWidth` crashes on pinch, `W ≤ gapWidth` passes, in `tests/unit/collision.test.ts`
- [X] T064 [P] [US2] Write failing hitbox tests: standing uses `H` and `W`; sliding uses `H × SLIDE_HEIGHT_FACTOR` and same width; jumping uses standing box at current `y`, in `tests/unit/hitbox.test.ts`
- [X] T065 [P] [US2] Write failing generator tests (oracle 8): with a fixed seed, no two consecutive obstacles are impassable for the given character; spacing is within `MIN_SPACING`–`MAX_SPACING` scaled by speed; kind weights approximate ground 0.4 / overhead 0.35 / pinch 0.25, in `tests/unit/obstacles.test.ts`
- [ ] T066 [P] [US2] Write failing loop tests (oracle 9): hidden page pauses; 10 s hidden does not advance distance; fixed timestep runs at `TICK_HZ`, in `tests/unit/loop.test.ts`
- [X] T067 [P] [US2] Write failing input tests: Space and ArrowUp jump, ArrowDown slides, click and tap jump, swipe-down slides; swipe needs vertical movement dominating horizontal, in `tests/unit/input.test.ts`
- [ ] T068 [P] [US2] Write failing Playwright test for Scenarios 3 and 4 (auto-run, jump, slide, tall vs short barrier, crash summary) in `tests/e2e/run-sketch-runner.spec.ts`

### Implementation for User Story 2

- [X] T069 [US2] Implement character state machine (`standing`, `jumping`, `sliding`, `crashed`) with buffered tap during slide, at `src/game/physics.ts`
- [X] T070 [US2] Implement hitbox from character metrics (standing, sliding, jumping) at `src/game/hitbox.ts`
- [X] T071 [US2] Implement collision rules: overhead by height against clearance, pinch by width against gap, ground gaps by airborne state, at `src/game/collision.ts`
- [X] T072 [US2] Implement procedural obstacle generator (seeded, spacing and weights from `game-rules.md`, no unpassable consecutive pair) at `src/game/obstacles.ts`
- [X] T073 [US2] Implement fixed-timestep loop at 60 Hz with accumulated time, pause on hidden page, blur, or pause control at `src/game/loop.ts`
- [X] T074 [US2] Implement input handling (pointer tap/click, swipe detection, keyboard Space/ArrowUp/ArrowDown) emitting `jump` and `slide` intents at `src/game/input.ts`
- [X] T075 [US2] Implement basic canvas renderer (ground, obstacles, character silhouette as filled shape; no effects yet) at `src/game/renderer.ts`
- [X] T076 [US2] Implement run screen: mounts canvas, HUD with distance, pause control, starts and ends a run at `src/screens/run-screen.ts`
- [X] T077 [US2] Implement summary screen: distance, outcome, Play again at `src/screens/summary-screen.ts`
- [X] T078 [US2] Wire run and summary into the screen router, with the run receiving the active `Character` at `src/main.ts`

**Checkpoint**: US2 plays alone with a fixture character. Quickstart Scenarios 3 and 4 pass.

---

## Phase 5: User Story 3 - Pick 2D or 3D and Start (Priority: P2)

**Goal**: After the model is ready, the player picks 2D (flat sketch) or 3D (rendered model), sees a live preview of each, and starts a run. If 3D is unavailable, 3D is shown as unavailable with the reason and 2D still starts.

**Independent Test**: With a ready character, choose 2D, run, return, choose 3D, run, confirm the sprite changes. Force a failed job and confirm 2D still starts. Quickstart Scenario 5.

### Tests for User Story 3 (write first, must fail)

- [X] T079 [P] [US3] Write failing unit tests for presentation state: default `2d`; change is allowed before each run; 3D is unavailable with reason when `modelStatus` is `failed`, `timed_out`, `cancelled`, or WebGL is missing, in `tests/unit/presentation.test.ts`
- [X] T080 [P] [US3] Write failing unit tests for sprite source selection: `2d` returns the sketch image, `3d` returns the model snapshot path, in `tests/unit/sprite-source.test.ts`
- [ ] T081 [P] [US3] Write failing Playwright test for mode choice, and for the Scenario 5 fallback (3D unavailable, 2D still starts), in `tests/e2e/mode-selection.spec.ts`

### Implementation for User Story 3

- [X] T082 [P] [US3] Implement WebGL availability check (try/catch around canvas context) at `src/character/webgl-check.ts`
- [X] T083 [US3] Implement presentation and availability logic (`presentation`, unavailable reason copy from the error table in `contracts/api.md`) at `src/screens/mode-availability.ts`
- [X] T084 [US3] Implement sprite source selection (sketch for 2D; rendered snapshot of the model for 3D) at `src/game/sprite-source.ts`
- [X] T085 [US3] Implement mode screen: two cards (2D, 3D) each with a live preview, 3D card disabled with reason when unavailable, press feedback `scale(0.97)`, at `src/screens/mode-screen.ts`
- [X] T086 [US3] Connect the renderer to the sprite source so the character appears as the chosen presentation at `src/game/renderer.ts`
- [X] T087 [US3] Route the processing→preview flow to the mode screen and then run screen at `src/main.ts`

**Checkpoint**: US3 works with US1 and US2. Quickstart Scenario 5 passes.

---

## Phase 6: User Story 4 - Feel the Game (Priority: P2)

**Goal**: Polished, animated feel: jump dust, landing burst, slide trail, ink splat on crash, score pop at milestones, parallax background, screen transitions, and reduced-motion fallback.

**Independent Test**: Play one run and confirm each effect fires at the right moment. Enable reduced motion and confirm the non-essential effects stop. Quickstart Scenario 7.

### Tests for User Story 4 (write first, must fail)

- [X] T088 [P] [US4] Write failing particle pool tests: pool never exceeds its cap; expired particles are recycled; reduced-motion option creates zero particles, in `tests/unit/particles.test.ts`
- [ ] T089 [P] [US4] Write failing event tests: `jump`, `land`, `slide`, `crash`, and `milestone` events are emitted from physics at the right moments, in `tests/unit/events.test.ts`
- [X] T090 [P] [US4] Write failing parallax tests: layer offsets advance with run speed and wrap, reduced-motion freezes layers, in `tests/unit/parallax.test.ts`
- [ ] T091 [P] [US4] Write failing Playwright test for Scenario 7 (effects visible in normal mode; transforms removed under `reducedMotion: 'reduce'`) in `tests/e2e/feel-the-game.spec.ts`

### Implementation for User Story 4

- [ ] T092 [US4] Implement game event bus emitting `jump`, `land`, `slide`, `crash`, `milestone` from physics and the loop at `src/game/events.ts`
- [X] T093 [US4] Implement particle system with a fixed-size pool and dust, slide trail, and ink-splat emitters at `src/game/effects/particles.ts`
- [X] T094 [P] [US4] Implement layered parallax background at `src/game/effects/parallax.ts`
- [X] T095 [US4] Wire effects into the renderer: dust on takeoff and landing, trail while sliding, ink splat on crash, all gated by the reduced-motion store, at `src/game/renderer.ts`
- [ ] T096 [US4] Implement score pop animation for every 500-unit milestone using CSS transform and opacity only, at `src/screens/run-screen.ts`
- [X] T097 [P] [US4] Implement component styles: button press (`transform: scale(0.97)` on `:active`, transition named properties only), card hover gated by `@media (hover: hover) and (pointer: fine)`, at `src/styles/components.css`
- [X] T098 [P] [US4] Implement screen layout styles (100dvh layouts, no `h-screen`, 16px side gutter at phone width) at `src/styles/screens.css`
- [X] T099 [US4] Apply screen transitions for every screen change in the router at `src/main.ts`
- [X] T100 [US4] Add a processing animation (sketch-line drawing of the character outline and a pulsing progress mark) using transform and opacity only, at `src/screens/processing-screen.ts`

**Checkpoint**: US4 effects work. Quickstart Scenario 7 passes.

---

## Phase 7: User Story 5 - Keep Your Best Run (Priority: P3)

**Goal**: Best distance stored on the device, shown on the start screen, and highlighted in the summary when beaten.

**Independent Test**: Finish a run with a new best, reload, and confirm the best is shown. Block storage and confirm the app still runs. Quickstart Scenario 8.

### Tests for User Story 5 (write first, must fail)

- [X] T101 [P] [US5] Write failing best-score tests: returns empty when storage is missing or throws; writes only when the new distance is greater; stores ISO `achievedAt`, in `tests/unit/best-score.test.ts`
- [ ] T102 [P] [US5] Write failing Playwright test for Scenario 8 (best shown after reload; storage blocked still plays) in `tests/e2e/best-score.spec.ts`

### Implementation for User Story 5

- [X] T103 [US5] Implement best-score store (`sketchRunner.best` as JSON `{ distance, achievedAt }`; every read and write in try/catch) at `src/game/best-score.ts`
- [X] T104 [US5] Record a new best at crash and highlight it on the summary screen at `src/screens/summary-screen.ts`
- [X] T105 [US5] Show the stored best on the upload (start) screen at `src/screens/upload-screen.ts`

**Checkpoint**: US5 works. Quickstart Scenario 8 passes.

---

## Phase 8: Polish and Cross-Cutting Concerns

**Purpose**: Operations, security, and quality gates across stories

- [ ] T106 [P] Implement cleanup endpoint for the daily cron: delete `inputs/*` for terminal jobs older than 24 h and `models/*` 7 days after `ready`, at `api/cron/cleanup.ts`
- [ ] T107 [P] Write test for the cleanup endpoint with fixture jobs in `tests/api/cleanup.test.ts`
- [ ] T108 [P] Security review pass on API: confirm `JOB_NOT_FOUND` is returned for wrong token, no raw upstream error text is stored or returned, no raw IP is stored, uploads limited by type and size; record findings in `specs/001-sketch-runner-3d/checklists/security-review.md`
- [X] T109 [P] Copy audit: grep `src/` and `index.html` for em-dash (`—`) and en-dash (`–`) characters in visible text; replace with hyphens or punctuation; record in `specs/001-sketch-runner-3d/checklists/copy-audit.md`
- [ ] T110 [P] Font audit: confirm no Inter default and no serif default in `src/styles/tokens.css` and `index.html` (plan Design Direction), at `src/styles/tokens.css`
- [ ] T111 Run `npm run coverage` and add tests until line and branch coverage reach at least 80% for `src/game/**` and `api/**`
- [X] T112 Verify production build splits the viewer: `@google/model-viewer` lives in a separate chunk not loaded on first screen (`npm run build`, check `dist/` output) and document result in `specs/001-sketch-runner-3d/checklists/bundle.md`
- [ ] T113 Run quickstart Scenarios 1–8 manually on desktop Chromium and an iPhone-size viewport, record results in `specs/001-sketch-runner-3d/checklists/quickstart-results.md`
- [ ] T114 Measure input latency (keydown to next frame) against `INPUT_LATENCY_TARGET_MS` and record in `specs/001-sketch-runner-3d/checklists/perf.md`

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks all stories.
- **US1 (Phase 3)** and **US2 (Phase 4)**: Both depend only on Foundational. They can run in parallel (US2 uses fixtures and does not need a real job).
- **US3 (Phase 5)**: Depends on US1 (needs a ready model) and US2 (needs the run).
- **US4 (Phase 6)**: Depends on US2 (renderer and events).
- **US5 (Phase 7)**: Depends on US2 (summary and crash).
- **Polish (Phase 8)**: Depends on all stories.

### User story dependency graph

```text
Setup → Foundational ─┬─► US1 ─┐
                      ├─► US2 ─┼─► US3
                      │        ├─► US4
                      │        └─► US5
                      └─────────────► Polish (after all)
```

### Within each story

Tests first and failing → models and helpers → services and workflow → endpoints and screens → wiring into `src/main.ts`.

## Parallel Execution Examples

**Phase 2**: T015, T016, T019, T020, T022, T024, T031, T033 can run together (different files).

**US1 tests**: T034–T042 can all be written together (different files).

**US1 implementation**: T043, T044, T046 run together; then T045; T052, T053, T054, T058 run together after the server and client contracts are in place.

**US2 tests**: T061–T068 can run together. **US2 implementation**: T070, T072, T074, T075 can overlap after T069.

**Polish**: T106–T110 can run together.

## Implementation Strategy

### MVP first (recommended)

1. Phase 1 and Phase 2
2. Phase 4 (US2), which is playable with a fixture character
3. Phase 3 (US1), which adds real characters and the 3D job

MVP scope: US1 and US2 together. US1 alone proves the drawing-to-model pipeline; US2 alone proves the game. Together they meet the two P1 stories.

### Incremental delivery

1. Add US3 (mode choice and 3D presentation)
2. Add US4 (feel and effects)
3. Add US5 (best score)
4. Polish and quality gates

Each step is deployable and testable on its own.

---

## Notes

- Tests in each story are written first and must fail before implementation (TDD per project rule).
- `[P]` tasks touch different files and have no dependency on incomplete tasks.
- Do not add `transition: all` or `window.addEventListener('scroll'` anywhere (enforced by T012).
- No em-dash or en-dash characters in visible text (enforced by T109).
- Commit only when asked; this repository has no git history yet.

# Quickstart Validation: Sketch Runner

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Contracts**: [api.md](contracts/api.md), [game-rules.md](contracts/game-rules.md)

This guide proves the feature works end to end. Implementation details live in `tasks.md`.

## Prerequisites

- Node.js 24 LTS and npm
- Vercel CLI 66.x (`npm i -g vercel@latest`); the installed 62.2.0 is outdated
- A Vercel account with a project linked: `vercel link` (one-time, interactive)
- Marketplace integrations provisioned for the project (Neon Postgres and Cloudflare R2, private store), using the guides from `vercel integration guide neon --framework vite` and the R2 bucket setup
- Local env: `vercel env pull .env.local --yes`, which must provide the database URL, R2 keys, and `SF3D_API_URL`

## Setup and run

```bash
npm install
npm run db:migrate            # creates model_jobs (migration in db/)
vercel dev                    # serves the client and /api functions together
```

Open the printed local URL in a desktop browser and in a phone-sized viewport.

## Scenario 1: Upload to mode selection (User Story 1 and 3)

1. Click **Upload**, choose a JPEG with a dark sketch on white paper.
2. Expect the outline preview with the detected silhouette before creation.
3. Confirm the external-service disclosure (FR-007); the job button stays disabled until checked.
4. Expect an animated processing state with progress text and a Cancel button.
5. When status reaches `ready`, the 3D preview appears; drag to rotate, pinch or scroll to zoom.
6. Expect the mode screen with **2D** and **3D** cards, each with a live preview.

**Pass**: Steps 1–6 complete without a page reload; processing never shows a frozen state.

## Scenario 2: Draw instead of upload (User Story 1)

1. Click **Draw**, draw a simple character with mouse, then with touch (or touch emulation).
2. Confirm it proceeds the same way as Scenario 1.

**Pass**: Drawing with pen and touch both produce an outline and a job.

## Scenario 3: Play the runner (User Story 2)

1. From the mode screen, choose **2D**, then start.
2. Do nothing for 3 s: the character keeps running and distance increases.
3. Press Space (or tap): the character jumps and lands.
4. Press Down (or swipe down): the character slides for about 0.65 s and stands again.
5. Reach an overhead barrier: a standing character with height above the barrier clearance crashes; a shorter one passes.
6. Crash: the summary shows distance and whether it beats the best score.

**Pass**: Jump and slide respond within 100 ms (measure with the Performance panel: input event to next frame). Crash summary appears.

## Scenario 4: Shape changes difficulty (User Story 2, SC-004)

1. Create two characters: a tall, narrow one and a short, wide one.
2. Play both to the same overhead barrier.
3. Confirm the tall character must slide while the short one can run under.

**Pass**: The tall character crashes on at least one overhead barrier that the short character passes standing, as specified by the tall-character rule in `game-rules.md`.

## Scenario 5: 3D failure fallback (FR-010, SC-006)

1. Set `SF3D_API_URL` to an unreachable address in `.env.local`, restart `vercel dev`.
2. Create a job; expect `SERVICE_UNAVAILABLE` with the message "The 3D maker is busy right now. You can still play in 2D."
3. On the mode screen, the 3D card shows as unavailable with the reason; the 2D card still starts a run.

**Pass**: No dead end; 2D run starts.

## Scenario 6: Job timeout and resume (FR-005, edge case)

1. Create a job, close the tab, reopen within the 10-minute window.
2. Expect the stored job token to resume polling and show the current status.
3. Force a timeout by setting `deadlineAt` in the past in the database (test-only helper), then poll.

**Pass**: Status becomes `timed_out` with a retry option; no silent loss.

## Scenario 7: Presentation and polish (User Story 4, FR-022–FR-025)

1. Play a run and confirm each effect fires: dust on takeoff and landing, trail while sliding, ink splat on crash, score pop at milestones.
2. Switch screens and confirm transitions play.
3. Enable the OS reduced-motion setting, reload, and repeat: parallax, particles, and screen movement are replaced by fades; gameplay is unchanged.

**Pass**: Effects are visible in normal mode; in reduced-motion mode, no transform-based motion remains outside the game's gameplay sprite movement.

## Scenario 8: Best score on device (User Story 5, FR-026)

1. Finish a run with a new best.
2. Reload the page. The start screen shows the stored best.
3. Block `localStorage` in the browser settings and reload.

**Pass**: Best is shown after reload; with storage blocked, the app loads and plays without error.

## Automated checks

```bash
npm run test          # unit: physics, collision, silhouette, obstacles, size cap
npm run test:api      # API handlers against a test database
npm run test:e2e      # Playwright: scenarios 1, 3, 5
npm run coverage      # must report at least 80%
npm run build         # production build; checks bundle split (model viewer separate)
```

## Done when

- All scenarios pass on desktop Chromium and on iOS Safari.
- Automated checks pass with coverage at least 80%.
- Design review: no em-dashes in visible text; one accent color; no Inter or serif defaults in the rendered page.

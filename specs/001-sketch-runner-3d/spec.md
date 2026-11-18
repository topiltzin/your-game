# Feature Specification: Sketch Runner — Draw Your Character

**Feature Branch**: `001-sketch-runner-3d` (no git repository in this project; no branch created)

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "The app will be a Game that will allow the user to upload a image/draw and we will render on 3d like on ~/emi-crafting/ same Call to render the 3d and once is loaded it allow to select 3d or 2d and Sketch Runner. The drawn character runs automatically. Players tap to jump and swipe to slide. Its shape affects how easily it fits through gaps, so a tall character may need to duck more often than a small one. Make the web UI super cool and allow a very cool experience. The game should be simple but cool and attractive, with nice animated effects."

## Clarifications

### Session 2026-11-18

- Q: What does choosing "3D" change in Sketch Runner? → A: The runner stays a 2D side-scroller; 3D mode shows the character as the rendered 3D model. Gameplay is identical in both modes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Turn a Drawing into a Character (Priority: P1)

A player opens the app and either uploads an image of a character or draws one directly in the app. The app sends it off to be turned into a 3D model. While that happens, the player sees an animated progress state. When the model is ready, the player sees it in an interactive 3D preview they can rotate and zoom.

**Why this priority**: Without a character, there is no game. This is the entry point to the whole experience and the core creative hook.

**Independent Test**: Upload one image (or draw one), wait for processing, and confirm the 3D preview loads and can be rotated. Delivers a personalized character with no gameplay needed.

**Acceptance Scenarios**:

1. **Given** the player is on the start screen, **When** they upload a supported image, **Then** the app shows a processing state and begins creating the 3D model.
2. **Given** the player is on the start screen, **When** they draw a character on the drawing canvas and confirm it, **Then** the drawing is used exactly as if it had been uploaded.
3. **Given** a model is still being created, **When** the player waits, **Then** they see an animated progress indicator, and the app never appears frozen.
4. **Given** the model is ready, **When** the player drags or pinches the preview, **Then** the 3D character rotates and zooms smoothly.
5. **Given** the player uploads an unsupported file type or an oversized file, **When** the upload is attempted, **Then** the app rejects it with a friendly message that names the accepted formats and size limit, and nothing is sent.

---

### User Story 2 - Run Sketch Runner (Priority: P1)

Once the character is ready, the player plays Sketch Runner. The character runs automatically to the right. The player taps (or clicks) to jump and swipes down (or presses the down key) to slide. Gaps and barriers appear along the way. A character that is taller than an overhead barrier's clearance must slide under it; a shorter character can run beneath it standing. A character that is wider than a pinch gap cannot squeeze through it, while a narrower one can.

**Why this priority**: This is the game itself. The shape-based difficulty is the distinctive mechanic that makes each player's character feel different.

**Independent Test**: Start a run with one character, reach a barrier that needs a slide and another that needs a jump, and confirm both are passable with the right input. Then repeat with a much taller character and confirm it must slide under barriers a short one can run under.

**Acceptance Scenarios**:

1. **Given** a run has started, **When** the player does nothing, **Then** the character keeps running automatically and the distance counter increases.
2. **Given** the character is running on the ground, **When** the player taps, **Then** the character jumps and lands back on the ground.
3. **Given** the character is running on the ground, **When** the player swipes down, **Then** the character slides for a short fixed duration and then gets back up.
4. **Given** an overhead barrier whose clearance is lower than the character's height, **When** the character reaches it standing, **Then** the character collides and the run ends.
5. **Given** the same overhead barrier and a character shorter than its clearance, **When** the character reaches it standing, **Then** the character passes without sliding.
6. **Given** a ground gap, **When** the character jumps at the right time, **Then** it clears the gap; **When** it jumps too late or too early, **Then** it falls and the run ends.
7. **Given** a run ends, **When** the summary appears, **Then** it shows the distance reached and whether it beats the device's best score.

---

### User Story 3 - Pick 2D or 3D and Start (Priority: P2)

After the model is loaded, the player is asked to choose between a 2D presentation (the flat drawn sketch) and a 3D presentation (the generated 3D model), then start Sketch Runner. The choice is visible in the game and can be changed from the start screen before each run.

**Why this priority**: Adds a meaningful choice and showcases the 3D render, but the game is playable in 2D alone, so it ranks below the core loop.

**Independent Test**: With a ready character, choose 2D, start a run, return, choose 3D, start a run, and confirm the character appears in the chosen style each time.

**Acceptance Scenarios**:

1. **Given** the 3D model is ready, **When** the mode screen appears, **Then** both "2D" and "3D" choices are offered with a live preview of each.
2. **Given** the player picks 2D, **When** a run starts, **Then** the character appears as the flat drawn sketch.
3. **Given** the player picks 3D, **When** a run starts, **Then** the character appears as the rendered 3D model.
4. **Given** the 3D model could not be created, **When** the mode screen appears, **Then** the 3D choice is shown as unavailable with the reason, and the 2D choice still starts a run.

---

### User Story 4 - Feel the Game (Priority: P2)

The whole experience feels polished and animated: smooth transitions between screens, a parallax background, dust puffs on takeoff and landing, a slide trail, a burst of sketch-style particles on a crash, and animated score feedback. Players who ask their device to reduce motion get the same game with non-essential animation turned off.

**Why this priority**: The brief asks for a very cool, attractive experience. It is essential for the product's appeal, but it layers on top of the working loop from User Stories 1 and 2.

**Independent Test**: Play one run and confirm each listed effect appears at the right moment. Then turn on the device's reduced-motion setting and confirm the non-essential effects stop.

**Acceptance Scenarios**:

1. **Given** a run is in progress, **When** the character jumps, lands, slides, or crashes, **Then** a matching visual effect plays at that moment.
2. **Given** the player moves between screens, **When** a screen changes, **Then** an animated transition plays.
3. **Given** the device has reduced motion enabled, **When** the game is played, **Then** background parallax, particles, and screen transitions are replaced by simple fades, and gameplay is unchanged.

---

### User Story 5 - Keep Your Best Run (Priority: P3)

The player's best distance is remembered on the device so they can try to beat it on the next visit.

**Why this priority**: A small motivation boost, not required for the core loop.

**Independent Test**: Finish a run, close and reopen the app, and confirm the best distance is still shown.

**Acceptance Scenarios**:

1. **Given** a run ends with a new best distance, **When** the summary appears, **Then** the new best is highlighted.
2. **Given** the player reopens the app on the same device, **When** the start screen loads, **Then** the previous best is shown.

---

### Edge Cases

- The drawing is nearly blank or has no clearly separated subject: the app asks the player to draw or upload again instead of creating an empty character.
- The character is extremely tall or extremely wide relative to the screen: its size is capped so it stays playable, and the cap is shown to the player.
- The image has a busy or colored background: the character is taken from the main drawn shape, and the player can preview the detected outline before continuing.
- The 3D service is slow or busy: the player sees progress, can keep waiting, or can cancel and try again; after 10 minutes the job is marked as timed out with a clear retry option.
- The 3D service fails or is unreachable: the player is told why and can still play in 2D.
- The player loses connection during model creation: the job resumes or reports failure when they return; no progress is silently lost.
- The player taps and swipes at the same moment: a swipe-down only slides when the character is on the ground; a tap while sliding is ignored until the slide ends.
- The player switches tabs or the device sleeps mid-run: the run pauses automatically.
- The player is using a keyboard, not a touch screen: jump and slide keys work the same as tap and swipe.

## Requirements *(mandatory)*

### Functional Requirements

**Character creation**

- **FR-001**: System MUST let the player provide a character either by uploading an image file or by drawing one in an in-app canvas that supports mouse, touch, and pen.
- **FR-002**: System MUST accept JPEG, PNG, WebP, and HEIC images up to 10 MB and MUST reject anything else with a message that names the accepted formats and limit.
- **FR-003**: System MUST derive the character's silhouette from the drawing, ignoring a plain white or transparent background, and MUST let the player see that outline before the run starts.
- **FR-004**: System MUST create a 3D model from the character through an asynchronous job, show animated progress while it runs, and let the player cancel or retry.
- **FR-005**: System MUST time out any model creation that runs longer than 10 minutes and offer a retry.
- **FR-006**: System MUST show the finished 3D model in an interactive preview the player can rotate and zoom.
- **FR-007**: System MUST tell the player before any upload or drawing is sent for 3D creation that the image will be processed by an external service.

**Mode selection**

- **FR-008**: System MUST offer a 2D and a 3D choice once the model is ready. In 3D mode the runner stays a 2D side-scroller and the character is displayed as the rendered 3D model; gameplay rules are identical in both modes.
- **FR-009**: System MUST allow the player to change the 2D/3D choice before each run.
- **FR-010**: If the 3D model cannot be created, System MUST mark the 3D choice as unavailable with the reason and MUST still let the player start a 2D run.

**Gameplay**

- **FR-011**: System MUST run the character forward automatically from the moment a run starts, with no input required to keep moving.
- **FR-012**: System MUST make the character jump on a tap or click, and MUST keep the jump arc short enough that the player can react to the next obstacle.
- **FR-013**: System MUST make the character slide on a swipe down or the down-arrow key, for a fixed short duration, and MUST only allow sliding while the character is on the ground.
- **FR-014**: System MUST support keyboard controls: Space or Up to jump, Down to slide.
- **FR-015**: System MUST generate ground gaps, overhead barriers, and narrow pinch gaps during a run.
- **FR-016**: System MUST compare the character's height against each overhead barrier's clearance: if the character is taller, it MUST slide to pass; if shorter, it MUST pass standing.
- **FR-017**: System MUST compare the character's width against each pinch gap: a character wider than the gap MUST NOT pass through it and the run ends on contact; narrower characters pass.
- **FR-018**: System MUST increase the run speed gradually over time so runs get harder.
- **FR-019**: System MUST end a run on any collision and show a summary with distance and best score.
- **FR-020**: System MUST pause automatically when the page loses focus or the player presses pause, and MUST resume on the player's command.
- **FR-021**: System MUST cap the character's displayed size so that extreme drawings remain playable, and MUST tell the player when the cap applies.

**Visual polish and feedback**

- **FR-022**: System MUST play a visual effect for each of: jump takeoff, landing, slide, crash, and score milestone.
- **FR-023**: System MUST play animated transitions between the upload, processing, mode selection, run, and summary screens.
- **FR-024**: System MUST show a parallax background that moves at a speed matching the run speed.
- **FR-025**: System MUST respect the device's reduced-motion setting, replacing non-essential animation with simple fades without changing gameplay.

**Persistence**

- **FR-026**: System MUST store the best distance on the device only, with no account required.

### Key Entities *(include if feature involves data)*

- **Character**: The player's drawing or upload, its detected silhouette, its overall height and width (used for gameplay), its size-cap status, and the 2D sketch and optional 3D model derived from it.
- **Model Creation Job**: One attempt to turn a character into a 3D model. Holds its status (queued, processing, ready, failed, timed out), when it was requested, and a friendly failure reason when applicable.
- **Obstacle**: A ground gap, overhead barrier, or pinch gap. Holds its type, position along the run, and the clearance or width it presents to the character.
- **Run**: One play session with a start time, distance reached, obstacles passed, and outcome.
- **Best Score**: The highest distance recorded on this device.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time player can go from choosing an image to starting their first run in under 2 minutes, not counting time spent waiting for the 3D model.
- **SC-002**: A player with a ready character can start a 2D run in 3 taps or clicks or fewer.
- **SC-003**: A jump or slide input is visibly reflected on screen within 100 milliseconds of the input.
- **SC-004**: In playtesting, at least 80% of players correctly predict, after one run, that a much taller character must slide under barriers that a short character can run under.
- **SC-005**: Players see a result, or a clear failure message with a retry option, for every model creation within 10 minutes of submitting it.
- **SC-006**: When the 3D model cannot be created, 100% of affected players are told why and can still start a 2D run.
- **SC-007**: During standard play on a mid-range phone, animation holds at least 55 frames per second with no visible stutter.
- **SC-008**: With reduced motion enabled, 100% of non-essential animations are removed while every gameplay action still works.
- **SC-009**: Playtesters rate the visual feel of the game at least 4 out of 5 on the question "This feels polished and fun."

## Assumptions

- **3D creation reuses the approach from the emi_crafting project**: the drawing is queued as a background job, an external image-to-3D service turns it into a 3D model, and the model is shown in an interactive viewer. That service is free and third-party-owned, so it may be slow, busy, or unavailable, and the 2D fallback in FR-010 covers that.
- **Privacy**: Drawings and uploads that go into 3D creation are processed by an external service. FR-007 requires telling the player this. Sharing a character is out of scope.
- **Standalone app**: This app is separate from emi_crafting. It does not share its accounts, database, or photo library. Only the 3D approach is reused.
- **No accounts in v1**: Players do not sign in. Characters live for the session, and only the best distance persists, on the device.
- **Single player, one character at a time**: There is no multiplayer and no saved character library in v1.
- **Input**: Touch devices use tap and swipe. Desktop uses click and keyboard. Both must work in the same session.
- **Silhouette detection**: Drawings are dark lines or shapes on a light or transparent background. Complex photographs are out of scope, though a photo still goes through the same pipeline.
- **Gap rules**: Height is what decides overhead barriers, and width decides pinch gaps. Ground gaps are cleared by jumping and do not depend on shape.
- **Target platforms**: Current mobile and desktop browsers. 3D preview needs WebGL support; on devices without it, 3D is shown as unavailable and 2D still works.
- **Design direction**: The UI should feel polished and animated, with a bold, playful, hand-drawn-sketch character. The detailed visual design system is chosen during planning, not here.
- **Scope of the 3D option**: Decided in clarification (2026-11-18): a 2D side-scroller that shows the character as its 3D model in 3D mode.
- **Reduced motion**: The device's reduced-motion setting is honored automatically; no in-game toggle is required in v1.

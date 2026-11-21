# Game Rules Contract: Sketch Runner

**Feature**: [spec.md](../spec.md) | **Data model**: [data-model.md](../data-model.md)

Single source for tuning. Values live in `src/game/config.ts`; this document is the reference and the test oracle. All units are logical units unless noted. The world is 1000 units wide per screen; the ground line is at y = 0 with y increasing upward.

## Constants (initial tuning, adjust after playtests)

| Constant | Value | Notes |
|---|---|---|
| `TICK_HZ` | 60 | Fixed timestep |
| `GRAVITY` | 2600 | units/s² |
| `JUMP_VELOCITY` | 980 | Gives a jump apex of about 1.5 average-character heights (keeps jumps short, FR-012) |
| `SLIDE_DURATION` | 0.65 s | FR-013 fixed short duration |
| `SLIDE_HEIGHT_FACTOR` | 0.45 | A sliding character is 45% of standing height |
| `START_SPEED` | 300 | units/s |
| `MAX_SPEED` | 820 | units/s |
| `SPEED_RAMP_PER_SECOND` | 6 | Gradual increase (FR-018) |
| `CHARACTER_HEIGHT_MIN` / `_MAX` | 90 / 260 | Normalized standing height after size cap |
| `CHARACTER_WIDTH_MIN` / `_MAX` | 60 / 200 | Normalized width after size cap |
| `CHARACTER_BASE_HEIGHT` | 150 | Height used to scale gap generation to the character |
| `INPUT_LATENCY_TARGET_MS` | 100 | SC-003 |

## Character metrics from silhouette

1. Flatten the drawing onto white. A pixel is foreground when its alpha is > 0.5 and its luminance < 0.9.
2. Keep the largest 8-connected foreground component; discard others under 2% of its area.
3. Bounding box in source pixels → normalize so the longer side maps to `CHARACTER_HEIGHT_MAX` if taller, keeping aspect ratio.
4. Clamp height to [`CHARACTER_HEIGHT_MIN`, `CHARACTER_HEIGHT_MAX`] and width to [`CHARACTER_WIDTH_MIN`, `CHARACTER_WIDTH_MAX`] while keeping aspect ratio. Set `sizeCapped = true` if clamping changed a value (FR-021).
5. If fewer than 500 foreground pixels remain after step 2, return `CHARACTER_UNREADABLE` (edge case: nearly blank drawing).

## Character states

```text
standing ──tap/jump key──► jumping ──land──► standing
standing ──swipe down/down key──► sliding ──timer ends or (no input)──► standing
jumping  ──(input ignored)
sliding  ──tap while sliding is ignored until slide ends (edge case)
any      ──collision──► crashed (run ends)
```

- Jump allowed only from `standing`.
- Slide allowed only from `standing` (on the ground), per FR-013.
- A tap during `sliding` is buffered for at most 0.1 s, then discarded; it does not queue a jump.

## Hitbox

- Standing: width `W = characterWidth`, height `H = characterHeight`, bottom at `y`.
- Sliding: height `H_s = H × SLIDE_HEIGHT_FACTOR`, same width, bottom at ground.
- Jumping: standing hitbox at current `y`.

## Obstacle rules

| Kind | Geometry | Passes when |
|---|---|---|
| `ground_gap` | Gap in the ground, `width` 80–180 scaled by `CHARACTER_BASE_HEIGHT` | Character is airborne (`y` high enough) when over the gap. Falls in if not. |
| `overhead` | Barrier at height `clearance` (range 130–220 standing-character scale) | Character is standing and `H ≤ clearance`, or sliding and `H_s ≤ clearance`. Otherwise crash. (FR-016) |
| `pinch` | Narrow opening, `gapWidth` 110–170 | `W ≤ gapWidth`. Otherwise crash on contact. (FR-017) |

**Tall character rule (acceptance scenario 4 and 5 in spec)**: For an overhead barrier with `clearance` between `H_s` and `H`, a character with `H > clearance` must slide, and a character with `H ≤ clearance` may run standing. Generator should place at least one barrier per run that separates the two cases for a given character, when the character's height is outside the common range, so the shape difference is felt early.

## Generator

- Obstacles spawn at `x = last.x + spacing` where `spacing` is random in [`MIN_SPACING`, `MAX_SPACING`] and shrinks as speed rises. `MIN_SPACING` = 420, `MAX_SPACING` = 760 units at `START_SPEED`, scaled down by up to 30% at `MAX_SPEED`.
- Obstacle kind chosen with weights ground 0.4, overhead 0.35, pinch 0.25. Never two consecutive obstacles that are unpassable for the current character (validation step in generator using the rules above).
- Generator is seeded per run (`seed` stored with the run) so tests can reproduce a run.

## Scoring

- `distance` increases by `speed × dt` each tick.
- Milestone effect every 500 units (FR-022 score milestone).
- On crash, summary shows `Math.floor(distance)`; a new best is recorded when it exceeds the stored best (FR-019, FR-026).

## Pause and focus

- `state = paused` on `visibilitychange` hidden, on `blur`, or on the pause control. Resume is explicit (FR-020).
- Timers use the loop's accumulated time, not wall clock, so pausing does not advance distance.

## Test oracle (unit tests must cover)

1. Standing character with `H ≤ clearance` passes an overhead barrier; with `H > clearance` crashes.
2. Sliding character with `H_s ≤ clearance` passes an overhead barrier that a standing taller character cannot pass.
3. `W > gapWidth` crashes on pinch; `W ≤ gapWidth` passes.
4. Jump from standing lands after exactly the airtime implied by the constants; jump from sliding is rejected.
5. Tap during slide is ignored after 0.1 s buffer expires.
6. Silhouette of a blank image returns `CHARACTER_UNREADABLE`.
7. Size cap sets `sizeCapped` only when clamping changes a value.
8. Generator never produces two consecutive obstacles impassable for the given character.
9. Pause preserves distance across a simulated 10 s hidden period.

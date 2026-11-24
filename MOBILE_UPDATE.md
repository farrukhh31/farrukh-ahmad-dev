# Mobile + Origin Tower update

## Player speed on phones
- Root cause: pushing the stick to its edge triggered sprint (13.6 u/s) and the stick had no dead zone.
- Touch now walks at 4.4 u/s (keyboard stays 8). Sprint is a button beside the stick (x1.45), never automatic.
- Stick has a 12% dead zone and an eased curve, so a light push is a slow, precise walk.
- Walk-cycle animation follows real speed, so feet no longer skate.
- Tuning knobs: `WALK_SPEED_TOUCH`, `RUN_MULTIPLIER_TOUCH` in `lib/game/input.ts`.

## Mobile responsive polish
- Joystick scales with the screen, respects safe areas, haptic feedback on supported phones.
- Pinch to zoom, touch-tuned drag to orbit (CameraRig).
- Zone panels are bottom sheets on phones with thumb-reach previous/next zone buttons, `dvh` heights, landscape-phone layout.
- Enter card and XP toast reposition for short landscape screens.
- Phones render at a lower pixel ratio with fewer sparkles and no MSAA.
- `100vh` heroes now use `100dvh` so the browser bar no longer causes jumps.

## Origin Tower
- 3D: stepped plinth, lit window bands (one instanced draw call), buttress fins, crown, floating crystal with
  a two-ring gyroscope and one shard per story chapter, sky beam, ground pulse ring.
- Reacts to the player: crystal, shards, beam and pulse speed up when you stand in the zone.
- Camera framing for the panel adjusted for the taller tower.
- About panel: swipeable chapters with tab strip, arrows and progress dots, plus a Toolbox of tags.

## Verification
`tsc --noEmit` clean, `next build` succeeds, 75 unit tests pass. `tests/gestures.test.ts` needs
`public/models/avatar.glb`, which was not in the uploaded zip.

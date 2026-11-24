<div align="center">

# 📱 Mobile + Origin Tower Update

**Slower, steadier movement on phones · a taller, reactive Origin Tower · polish across every panel.**

</div>

## 🎮 Player speed on phones

> [!NOTE]
> **Root cause:** pushing the stick to its edge triggered sprint (13.6 u/s), and the stick had no dead zone.

| Before | After |
|---|---|
| Edge of stick = automatic sprint | Touch walks at **4.4 u/s** (keyboard stays 8) |
| No dead zone | **12 % dead zone** and an eased curve, so a light push is a slow, precise walk |
| Sprint was implicit | Sprint is a **button beside the stick** (×1.45), never automatic |
| Feet skated at low speeds | Walk-cycle animation follows real speed |

**Tuning knobs:** `WALK_SPEED_TOUCH` and `RUN_MULTIPLIER_TOUCH` in `lib/game/input.ts`.

## ✨ Mobile responsive polish

- Joystick scales with the screen, respects safe areas, and gives haptic feedback on supported phones.
- **Pinch to zoom** and touch-tuned drag to orbit (`CameraRig`).
- Zone panels are **bottom sheets** on phones, with thumb-reach previous/next zone buttons, `dvh` heights and a landscape-phone layout.
- The Enter card and XP toast reposition for short landscape screens.
- Phones render at a lower pixel ratio with fewer sparkles and no MSAA.
- `100vh` heroes now use `100dvh`, so the browser bar no longer causes jumps.

## 🗼 Origin Tower

**3D**
- Stepped plinth, lit window bands (one instanced draw call), buttress fins and a crown.
- Floating crystal with a two-ring gyroscope and one shard per story chapter.
- Sky beam and ground pulse ring.

**Reactive** — the crystal, shards, beam and pulse speed up when you stand in the zone.

**Camera** — framing for the panel adjusted for the taller tower.

**About panel** — swipeable chapters with tab strip, arrows and progress dots, plus a **Toolbox** of tags.

## ✅ Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean |
| `next build` | ✅ succeeds |
| Unit tests | ✅ 75 pass |

> [!NOTE]
> `tests/gestures.test.ts` needs `public/models/avatar.glb`, which was not in the uploaded zip.
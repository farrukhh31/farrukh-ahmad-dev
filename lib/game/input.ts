import { SPAWN } from "./zones";

/**
 * Mutable, non-reactive input + player state.
 * These change every frame, so they deliberately live outside React/zustand
 * to avoid re-rendering the UI 60 times a second.
 */
export const input = {
  keys: new Set<string>(),
  /** Virtual joystick, each axis -1..1 (x right, y up). */
  joy: { x: 0, y: 0 },
  /** On-screen Sprint button (touch). Sticky until toggled off or the thumb lifts for a while. */
  sprint: false,
};

/**
 * Walking speed in world units per second.
 * A phone screen shows far less of the world than a desktop window, so the same 8 u/s that feels
 * fine with a keyboard looks like a rocket on a 6-inch display. Touch gets its own, calmer pace.
 */
export const WALK_SPEED_KEYS = 8;
export const WALK_SPEED_TOUCH = 4.4;
export const RUN_MULTIPLIER_KEYS = 1.7;
export const RUN_MULTIPLIER_TOUCH = 1.45;

/** Thumb-stick feel: ignore tiny drifts, then ease in so a light push is a slow, precise walk. */
const JOY_DEADZONE = 0.12;
const JOY_CURVE = 1.35;
export function shapeStick(x: number, y: number): { x: number; y: number } {
  const m = Math.hypot(x, y);
  if (m <= JOY_DEADZONE) return { x: 0, y: 0 };
  const t = Math.min(1, (m - JOY_DEADZONE) / (1 - JOY_DEADZONE));
  const k = Math.pow(t, JOY_CURVE) / m;
  return { x: x * k, y: y * k };
}

export const playerState = {
  x: SPAWN[0],
  z: SPAWN[1],
  heading: 0, // 0 = facing +Z, i.e. toward the camera
  /** Camera orbit angle around the player (0 = camera south of the player). */
  camYaw: 0,
  moving: false,
  /** Current ground speed in world units per second (drives the walk-cycle rate so feet never skate). */
  speed: 0,
  /** Set to teleport (fast travel); consumed by the Player. */
  teleportTo: null as [number, number] | null,
};

export function readMoveVector(): { x: number; z: number; touch: boolean } {
  const k = input.keys;
  let x = 0;
  let z = 0;
  // W A S D walk; the arrow keys belong to the camera (orbit + zoom, see CameraRig)
  if (k.has("KeyW")) z -= 1;
  if (k.has("KeyS")) z += 1;
  if (k.has("KeyA")) x -= 1;
  if (k.has("KeyD")) x += 1;

  const keyed = x !== 0 || z !== 0;
  const stick = shapeStick(input.joy.x, input.joy.y);
  x += stick.x;
  z -= stick.y;

  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  // keyboard wins when both are used at once, so a tablet with a keyboard keeps the desktop pace
  return { x, z, touch: !keyed && (stick.x !== 0 || stick.y !== 0) };
}

/** Shift on keyboard, or the on-screen Sprint button. Pushing the stick to its edge no longer sprints by accident. */
export function isRunning(): boolean {
  return input.keys.has("ShiftLeft") || input.keys.has("ShiftRight") || input.sprint;
}

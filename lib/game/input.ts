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
};

export const playerState = {
  x: SPAWN[0],
  z: SPAWN[1],
  heading: 0, // 0 = facing +Z, i.e. toward the camera
  /** Camera orbit angle around the player (0 = camera south of the player). */
  camYaw: 0,
  moving: false,
  /** Set to teleport (fast travel); consumed by the Player. */
  teleportTo: null as [number, number] | null,
};

export function readMoveVector(): { x: number; z: number } {
  const k = input.keys;
  let x = 0;
  let z = 0;
  if (k.has("KeyW") || k.has("ArrowUp")) z -= 1;
  if (k.has("KeyS") || k.has("ArrowDown")) z += 1;
  if (k.has("KeyA") || k.has("ArrowLeft")) x -= 1;
  if (k.has("KeyD") || k.has("ArrowRight")) x += 1;

  x += input.joy.x;
  z -= input.joy.y;

  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  return { x, z };
}

/** Shift on keyboard, or pushing the touch stick all the way out. */
export function isRunning(): boolean {
  return (
    input.keys.has("ShiftLeft") ||
    input.keys.has("ShiftRight") ||
    Math.hypot(input.joy.x, input.joy.y) > 0.92
  );
}

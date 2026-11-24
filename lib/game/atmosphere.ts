import * as THREE from "three";

/**
 * Night / Day palettes. `atmosphere.day` eases between 0 (night) and 1 (day)
 * and every environment component reads it each frame, so switching theme
 * is a smooth cross-fade instead of a pop.
 */
export const atmosphere = { day: 0 };

const c = (hex: string) => new THREE.Color(hex);

export const PAL = {
  bg: [c("#030712"), c("#bcd6dc")],
  fog: [c("#030712"), c("#c5dde2")],
  skyTop: [c("#02040c"), c("#6aa5d4")],
  skyBottom: [c("#0b1230"), c("#e4f1f3")],
  hemiSky: [c("#6d8bff"), c("#eef8ff")],
  hemiGround: [c("#0a0f24"), c("#8fb0ba")],
  sun: [c("#c9dcff"), c("#fff4d6")],
  dirLight: [c("#a5b4fc"), c("#fff1d9")],
  groundBase: [c("#050b18"), c("#7ea6b0")],
  groundLine: [c("#22d3ee"), c("#eaf8fb")],
  rock: [c("#0e1630"), c("#9db4c4")],
  cloudTop: [c("#4b5d96"), c("#ffffff")],
  cloudShade: [c("#0f1633"), c("#b7d0e4")],
  lip: [c("#1d2c58"), c("#f1ecf7")],
} as const;

export const NUM = {
  hemiIntensity: [0.9, 1.3],
  dirIntensity: [0.8, 2.0],
  fogNear: [45, 80],
  fogFar: [130, 210],
  aurora: [1, 0],
  stars: [1, 0],
} as const;

export function blend(out: THREE.Color, pair: readonly THREE.Color[], d: number) {
  return out.lerpColors(pair[0], pair[1], d);
}

export function mixNum(pair: readonly number[], d: number) {
  return pair[0] + (pair[1] - pair[0]) * d;
}

// direction of the sun / moon in the sky (behind the Origin Tower, in view)
export const SUN_DIR = new THREE.Vector3(-0.35, 0.3, -0.89).normalize();

/** Mirrors prefers-reduced-motion so frame loops can calm themselves down. */
export const motion = { reduced: false };

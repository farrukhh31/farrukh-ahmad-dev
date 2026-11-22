import * as THREE from "three";

/**
 * Procedural avatar gestures ("expressions") layered on top of the baked Idle / Walk / Wave clips.
 *
 * Why procedural: the Blender rig stores each arm bone flipped 180 degrees, so a bone's own axes are
 * confusing. Every gesture here is therefore described as a rotation in the avatar's own frame
 * (x = its left/right, y = up, z = the direction it faces) and converted into each bone's local space.
 * Pure three.js maths with no React, so the poses can be unit-tested against the real avatar.glb.
 */
export type EmoteName = "wave" | "cheer" | "bow" | "think";

export interface EmoteInfo {
  id: EmoteName;
  label: string;
  key: string;
  seconds: number;
}

export const EMOTES: EmoteInfo[] = [
  { id: "wave", label: "Wave", key: "1", seconds: 2 },
  { id: "cheer", label: "Cheer", key: "2", seconds: 2.4 },
  { id: "bow", label: "Bow", key: "3", seconds: 2 },
  { id: "think", label: "Think", key: "4", seconds: 2.8 },
];

export const EMOTE_BY_KEY = Object.fromEntries(EMOTES.map((e) => [e.key, e.id])) as Record<string, EmoteName>;

/** three.js strips "." from node names, so "upper_arm.L" arrives as "upper_armL". Accept both. */
const BONE_NAMES = {
  upperL: ["upper_armL", "upper_arm.L"],
  foreL: ["forearmL", "forearm.L"],
  upperR: ["upper_armR", "upper_arm.R"],
  foreR: ["forearmR", "forearm.R"],
  spine: ["spine"],
  head: ["head"],
} as const;

export type BoneKey = keyof typeof BONE_NAMES;
export type BoneSet = Partial<Record<BoneKey, THREE.Object3D>>;

export function findBones(root: THREE.Object3D): BoneSet {
  const found: BoneSet = {};
  root.traverse((o) => {
    for (const key of Object.keys(BONE_NAMES) as BoneKey[]) {
      if ((BONE_NAMES[key] as readonly string[]).includes(o.name)) found[key] = o;
    }
  });
  return found;
}

const deg = (d: number) => (d * Math.PI) / 180;
const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);

type Step = { bone: BoneKey; axis: THREE.Vector3; angle: number };

/** 0 -> 1 -> hold -> 0 over `seconds`, eased. */
export function envelope(t: number, seconds: number): number {
  const rise = 0.35;
  const fall = 0.45;
  if (t <= 0 || t >= seconds) return 0;
  const up = Math.min(1, t / rise);
  const down = Math.min(1, (seconds - t) / fall);
  const k = Math.min(up, down);
  return k * k * (3 - 2 * k);
}

/**
 * The rotations that make up a gesture at time `t`, in the order they must be applied
 * (parents before children). Left arm is at +x, right arm at -x, the avatar faces +z.
 */
export function stepsFor(name: EmoteName, t: number): Step[] {
  switch (name) {
    case "cheer": {
      const wiggle = Math.sin(t * 13) * deg(9);
      return [
        { bone: "upperL", axis: Z, angle: deg(150) + wiggle },
        { bone: "upperR", axis: Z, angle: -deg(150) - wiggle },
        { bone: "foreL", axis: Z, angle: deg(18) },
        { bone: "foreR", axis: Z, angle: -deg(18) },
        { bone: "head", axis: X, angle: -deg(12) },
      ];
    }
    case "bow":
      return [
        { bone: "spine", axis: X, angle: deg(38) },
        { bone: "head", axis: X, angle: deg(14) },
      ];
    case "think":
      return [
        { bone: "upperR", axis: X, angle: -deg(58) },
        { bone: "foreR", axis: X, angle: -deg(120) },
        { bone: "head", axis: Z, angle: deg(8) + Math.sin(t * 2.2) * deg(3) },
      ];
    default:
      return []; // "wave" uses the baked clip
  }
}

/** Vertical hop (metres) for the cheer. */
export const hopFor = (name: EmoteName, t: number, weight: number) =>
  name === "cheer" ? Math.abs(Math.sin(t * 7)) * 0.16 * weight : 0;

const qDelta = new THREE.Quaternion();
const qFrame = new THREE.Quaternion();
const qFrameInv = new THREE.Quaternion();
const qParent = new THREE.Quaternion();
const qParentInv = new THREE.Quaternion();
const qWorld = new THREE.Quaternion();

/**
 * Apply a gesture on top of the pose the animation mixer just wrote.
 * `frame` is the object whose axes define "the avatar's own frame" (the avatar group).
 * `weight` (0..1) blends the gesture in and out.
 */
export function applyGesture(frame: THREE.Object3D, bones: BoneSet, name: EmoteName, t: number, weight: number) {
  if (weight <= 0) return;
  frame.updateWorldMatrix(true, false);
  frame.getWorldQuaternion(qFrame);
  qFrameInv.copy(qFrame).invert();

  for (const step of stepsFor(name, t)) {
    const bone = bones[step.bone];
    if (!bone?.parent) continue;
    bone.parent.updateWorldMatrix(true, false);
    bone.parent.getWorldQuaternion(qParent);
    qParentInv.copy(qParent).invert();

    // rotation in the avatar's frame -> the same rotation in world space -> in the bone's parent space
    qDelta.setFromAxisAngle(step.axis, step.angle * weight);
    qWorld.copy(qFrame).multiply(qDelta).multiply(qFrameInv);
    bone.quaternion.premultiply(qParentInv.multiply(qWorld).multiply(qParent));
  }
}

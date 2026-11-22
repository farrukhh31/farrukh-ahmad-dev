import fs from "node:fs";
import * as THREE from "three";
import { beforeAll, describe, expect, it } from "vitest";
import { EMOTES, applyGesture, envelope, findBones, stepsFor, type BoneSet } from "@/lib/game/gestures";

/** Loads the real avatar.glb (the one shipped to visitors) and checks where the hands end up. */
let scene: THREE.Group;
let bones: BoneSet;
let rest: Map<THREE.Object3D, THREE.Quaternion>;

beforeAll(async () => {
  (globalThis as { self?: unknown }).self ??= globalThis;
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const buf = fs.readFileSync("public/models/avatar.glb");
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const origWarn = console.error;
  console.error = () => {}; // the loader complains about the embedded texture in node; irrelevant here
  const gltf = await new Promise<{ scene: THREE.Group }>((res, rej) => new GLTFLoader().parse(ab, "", res, rej));
  console.error = origWarn;
  scene = gltf.scene;
  bones = findBones(scene);
  rest = new Map();
  scene.traverse((o) => rest.set(o, o.quaternion.clone()));
});

const reset = () => {
  scene.traverse((o) => o.quaternion.copy(rest.get(o)!));
  scene.updateMatrixWorld(true);
};
/** the wrist = elbow + the forearm bone's own +Y axis * its length (~0.3 m) */
const wrist = (b: THREE.Object3D) => {
  const p = b.getWorldPosition(new THREE.Vector3());
  const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(b.getWorldQuaternion(new THREE.Quaternion()));
  return p.addScaledVector(dir, 0.3);
};
const pose = (name: Parameters<typeof applyGesture>[2], t = 1) => {
  reset();
  applyGesture(scene, bones, name, t, 1);
  scene.updateMatrixWorld(true);
};
const head = () => bones.head!.getWorldPosition(new THREE.Vector3());

describe("avatar rig", () => {
  it("finds every bone the gestures need", () => {
    expect(Object.keys(bones).sort()).toEqual(["foreL", "foreR", "head", "spine", "upperL", "upperR"]);
  });
});

describe("gestures on the real avatar", () => {
  it("rest pose: arms hang below the shoulders", () => {
    reset();
    expect(wrist(bones.foreL!).y).toBeLessThan(1.3);
    expect(wrist(bones.foreR!).y).toBeLessThan(1.3);
  });

  it("cheer: both hands go above the head, on their own side", () => {
    pose("cheer", 0.3);
    const l = wrist(bones.foreL!);
    const r = wrist(bones.foreR!);
    expect(l.y).toBeGreaterThan(head().y);
    expect(r.y).toBeGreaterThan(head().y);
    expect(l.x).toBeGreaterThan(0); // left hand stays on the left (+x)
    expect(r.x).toBeLessThan(0);
  });

  it("bow: the head moves forward (+z, the way the avatar faces) and down", () => {
    reset();
    const before = head();
    pose("bow");
    const after = head();
    expect(after.z).toBeGreaterThan(before.z + 0.3);
    expect(after.y).toBeLessThan(before.y);
  });

  it("think: the right hand comes up in front of the chest, the left arm stays down", () => {
    pose("think", 0);
    const r = wrist(bones.foreR!);
    expect(r.z).toBeGreaterThan(0.1);
    expect(r.y).toBeGreaterThan(1.3);
    expect(wrist(bones.foreL!).y).toBeLessThan(1.3);
  });

  it("weight 0 leaves the pose untouched, weight 1 changes it", () => {
    reset();
    const before = bones.upperL!.quaternion.clone();
    applyGesture(scene, bones, "cheer", 0.5, 0);
    expect(bones.upperL!.quaternion.angleTo(before)).toBeLessThan(1e-3);
    applyGesture(scene, bones, "cheer", 0.5, 1);
    expect(bones.upperL!.quaternion.angleTo(before)).toBeGreaterThan(1);
  });

  it("the wave is a baked clip, so it adds no procedural steps", () => {
    expect(stepsFor("wave", 1)).toEqual([]);
  });
});

describe("timing", () => {
  it("eases in and out and is zero outside the gesture", () => {
    expect(envelope(0, 2)).toBe(0);
    expect(envelope(2, 2)).toBe(0);
    expect(envelope(1, 2)).toBe(1);
    expect(envelope(0.1, 2)).toBeGreaterThan(0);
    expect(envelope(0.1, 2)).toBeLessThan(1);
  });
  it("gives every emote a unique key", () => {
    expect(new Set(EMOTES.map((e) => e.key)).size).toBe(EMOTES.length);
  });
});

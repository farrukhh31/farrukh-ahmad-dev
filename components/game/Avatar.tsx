"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useFBX, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

import AvatarPlaceholder from "./AvatarPlaceholder";
import { playerState } from "@/lib/game/input";
import { useGame } from "@/lib/game/store";
import { EMOTES, applyGesture, envelope, findBones, hopFor, type EmoteName } from "@/lib/game/gestures";

export const AVATAR_URL = "/models/avatar.glb";
/** Optional Blender FBX. If this file exists in /public/models it is used instead of the GLB. */
export const AVATAR_FBX_URL = "/models/avatar.fbx";

type Clip = "Idle" | "Walk" | "Wave";

// three.js actions are mutable engine objects; tweak them through helpers
function configureOneShot(action: THREE.AnimationAction) {
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
}

/**
 * The Blender-made character. Clips baked into the GLB: Idle, Walk, Wave.
 *  - moving   -> Walk (faster while Shift is held)
 *  - standing -> Idle
 *  - Wave     -> plays on spawn and each time a new zone is discovered
 */
function AvatarModel({ scene, animations }: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }) {
  const group = useRef<THREE.Group>(null);
  const model = useMemo(() => cloneSkinned(scene), [scene]);
  const { actions, mixer } = useAnimations(animations, group);

  const current = useRef<Clip | null>(null);
  const waving = useRef(false);
  const bones = useMemo(() => findBones(model), [model]);
  /** the gesture being performed right now (cheer / bow / think); the wave is a baked clip */
  const gesture = useRef<{ name: EmoteName; start: number | null } | null>(null);

  const play = (name: Clip) => {
    const next = actions[name];
    if (!next || current.current === name) return;
    const prev = current.current ? actions[current.current] : null;
    next.reset().setEffectiveWeight(1).fadeIn(0.2).play();
    prev?.fadeOut(0.2);
    current.current = name;
  };

  // one-shot wave
  useEffect(() => {
    const wave = actions.Wave;
    if (!wave) return;
    configureOneShot(wave);

    const onDone = (e: { action: THREE.AnimationAction }) => {
      if (e.action === wave) waving.current = false;
    };
    mixer.addEventListener("finished", onDone as never);

    const startWave = () => {
      if (waving.current || playerState.moving) return;
      waving.current = true;
      play("Wave");
    };

    const first = setTimeout(startWave, 900);
    const perform = (name: EmoteName) => {
      if (playerState.moving) return;
      if (name === "wave") {
        gesture.current = null;
        startWave();
      } else {
        waving.current = false;
        gesture.current = { name, start: null }; // start time is set on the next frame
      }
    };

    const unsub = useGame.subscribe((s, prev) => {
      if (s.emote && s.emote !== prev.emote) perform(s.emote.name);
      else if (s.lastGain && s.lastGain !== prev.lastGain && s.lastGain.kind !== "skill") {
        perform(s.lastGain.kind === "achievement" ? "cheer" : "wave");
      }
    });

    return () => {
      clearTimeout(first);
      unsub();
      mixer.removeEventListener("finished", onDone as never);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, mixer]);

  useFrame((state) => {
    // procedural gestures sit on top of whatever the mixer just played this frame
    const g = gesture.current;
    if (g && !playerState.moving) {
      const now = state.clock.elapsedTime;
      g.start ??= now;
      const t = now - g.start;
      const seconds = EMOTES.find((e) => e.id === g.name)?.seconds ?? 2;
      const weight = envelope(t, seconds);
      if (group.current) {
        applyGesture(group.current, bones, g.name, t, weight);
        group.current.position.y = hopFor(g.name, t, weight);
      }
      if (t >= seconds) gesture.current = null;
    } else {
      if (g) gesture.current = null;
      if (group.current && group.current.position.y !== 0) group.current.position.y = 0;
    }

    if (playerState.moving) {
      waving.current = false;
      play("Walk");
      const walk = actions.Walk;
      // follow the real ground speed: a slow thumb-stick walk gets a slow stride
      const want = THREE.MathUtils.clamp(playerState.speed * 0.2, 0.7, 2.8);
      if (walk) walk.setEffectiveTimeScale(THREE.MathUtils.lerp(walk.timeScale, want, 0.2));
    } else if (waving.current) {
      play("Wave");
    } else {
      play("Idle");
    }
  });

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  );
}

/* ----------------------------- loading: GLB or FBX ----------------------------- */

const CLIPS = ["Idle", "Walk", "Wave"] as const;

/** FBX is Blender's usual hand-off format; bring it in line with how the GLB behaves. */
function prepareFbx(fbx: THREE.Group) {
  const root = new THREE.Group();
  root.add(cloneSkinned(fbx));
  root.updateMatrixWorld(true);

  // FBX files from Blender are often in centimetres (100x too big). Fix it from the measured height.
  const height = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y;
  if (height > 20) root.scale.setScalar(0.01);
  else if (height > 0 && height < 0.05) root.scale.setScalar(100);

  // Blender names FBX takes "Armature|Idle": keep only the clip name the game looks for
  const animations = fbx.animations.map((clip) => {
    const copy = clip.clone();
    const last = copy.name.split("|").pop() ?? copy.name;
    copy.name = CLIPS.find((c) => c.toLowerCase() === last.toLowerCase()) ?? last;
    return copy;
  });
  return { scene: root, animations };
}

function GlbAvatar() {
  const { scene, animations } = useGLTF(AVATAR_URL);
  return <AvatarModel scene={scene} animations={animations} />;
}

function FbxAvatar() {
  const fbx = useFBX(AVATAR_FBX_URL);
  const { scene, animations } = useMemo(() => prepareFbx(fbx), [fbx]);
  return <AvatarModel scene={scene} animations={animations} />;
}

type Kind = "fbx" | "glb" | null;
/**
 * The GLB is used unless NEXT_PUBLIC_AVATAR_FBX=true is set in .env.local; only then does the game
 * look for /models/avatar.fbx (so normal visitors never make a request for a file that is not there).
 */
let detected: Kind = process.env.NEXT_PUBLIC_AVATAR_FBX === "true" ? null : "glb";
if (detected === "glb") useGLTF.preload(AVATAR_URL);

/** With the FBX switch on: uses /models/avatar.fbx when it exists, otherwise the GLB. Checked once. */
function useAvatarKind(): Kind {
  const [kind, setKind] = useState<Kind>(detected);
  useEffect(() => {
    if (detected) return;
    let cancelled = false;
    fetch(AVATAR_FBX_URL, { method: "HEAD" })
      .then((r): Kind => (r.ok && !(r.headers.get("content-type") ?? "").includes("text/html") ? "fbx" : "glb"))
      .catch((): Kind => "glb")
      .then((k) => {
        detected = k;
        if (k === "glb") useGLTF.preload(AVATAR_URL);
        if (!cancelled) setKind(k);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return kind;
}

export default function Avatar() {
  const kind = useAvatarKind();
  if (!kind) return <AvatarPlaceholder />;
  return kind === "fbx" ? <FbxAvatar /> : <GlbAvatar />;
}
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

import { isRunning, playerState } from "@/lib/game/input";
import { useGame } from "@/lib/game/store";
import { EMOTES, applyGesture, envelope, findBones, hopFor, type EmoteName } from "@/lib/game/gestures";

export const AVATAR_URL = "/models/avatar.glb";

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
export default function Avatar() {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(AVATAR_URL);
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
      const run = isRunning();
      const walk = actions.Walk;
      if (walk) walk.setEffectiveTimeScale(THREE.MathUtils.lerp(walk.timeScale, run ? 2.6 : 1.8, 0.2));
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

useGLTF.preload(AVATAR_URL);

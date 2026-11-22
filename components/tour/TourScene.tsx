"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";

import Atmosphere from "@/components/game/Atmosphere";
import Sky from "@/components/game/Sky";
import World from "@/components/game/World";
import Props from "@/components/game/Props";
import NightStars from "@/components/game/NightStars";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { motion } from "@/lib/game/atmosphere";
import { useGame } from "@/lib/game/store";
import { TOUR_STOPS } from "@/lib/tour/stops";

const N = TOUR_STOPS.length;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Maps scroll progress (0..1) to a point on the flight path. The camera
 * lingers at each stop and glides between them.
 */
function dwell(p: number) {
  const x = p * (N - 1);
  const i = Math.min(N - 2, Math.floor(x));
  const f = x - i;
  return (i + smooth(0.18, 0.82, f)) / (N - 1);
}

function Rig({ progress, onStop, onReady }: { progress: { current: number }; onStop: (i: number) => void; onReady?: () => void }) {
  const camera = useThree((s) => s.camera);
  const { posCurve, lookCurve } = useMemo(
    () => ({
      posCurve: new THREE.CatmullRomCurve3(TOUR_STOPS.map((s) => new THREE.Vector3(...s.cam)), false, "centripetal"),
      lookCurve: new THREE.CatmullRomCurve3(TOUR_STOPS.map((s) => new THREE.Vector3(...s.look)), false, "centripetal"),
    }),
    [],
  );
  const smoothP = useRef(progress.current);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const last = useRef(-1);
  const frames = useRef(0);

  useFrame((_, rawDt) => {
    if (frames.current < 4 && ++frames.current === 4) onReady?.();
    const dt = Math.min(rawDt, 0.05);
    smoothP.current += (progress.current - smoothP.current) * (1 - Math.exp(-dt * (motion.reduced ? 30 : 3.4)));
    const p = Math.min(1, Math.max(0, smoothP.current));
    const t = dwell(p);
    posCurve.getPoint(t, pos);
    lookCurve.getPoint(t, look);
    camera.position.copy(pos);
    camera.lookAt(look);

    const idx = Math.round(p * (N - 1));
    if (idx !== last.current) {
      last.current = idx;
      onStop(idx);
    }
  });
  return null;
}

export default function TourScene({ progress, onStop, onReady }: { progress: { current: number }; onStop: (i: number) => void; onReady?: () => void }) {
  const quality = useGame((s) => s.quality);
  const setQuality = useGame((s) => s.setQuality);
  const high = quality === "high";
  const systemReduced = useReducedMotion();
  const motionPref = useGame((s) => s.motionPref);
  const reduced = systemReduced || motionPref === "reduce";

  useEffect(() => {
    motion.reduced = reduced;
  }, [reduced]);

  return (
    <Canvas
      dpr={high ? [1, 1.75] : [1, 1]}
      camera={{ fov: 50, near: 0.5, far: 320, position: TOUR_STOPS[0].cam }}
      gl={{ antialias: high, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none" }}
      aria-label="Animated 3D flight over the portfolio islands. Scroll to move between them."
      onCreated={({ gl }) => {
        // fall back to the lighter renderer if the GPU is struggling
        gl.domElement.addEventListener("webglcontextlost", () => setQuality("low"));
      }}
    >
      <Atmosphere />
      <Environment frames={1} resolution={high ? 128 : 32}>
        <Lightformer form="rect" intensity={2.2} color="#22d3ee" position={[-12, 6, -6]} scale={[24, 8, 1]} rotation-y={Math.PI / 2.5} />
        <Lightformer form="rect" intensity={2.2} color="#8b5cf6" position={[12, 5, 6]} scale={[24, 8, 1]} rotation-y={-Math.PI / 2.5} />
        <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, 14, 0]} rotation-x={Math.PI / 2} scale={[30, 30, 1]} />
      </Environment>

      <Suspense fallback={null}>
        <Sky />
        <World />
        <Props high={high && !reduced} />
        <NightStars high={high} still={reduced} />
        <Rig progress={progress} onStop={onStop} onReady={onReady} />
      </Suspense>

      {high && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.8} luminanceThreshold={1} luminanceSmoothing={0.2} mipmapBlur />
        </EffectComposer>
      )}
    </Canvas>
  );
}

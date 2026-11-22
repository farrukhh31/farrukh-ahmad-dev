"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor, Sparkles } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";

import { motion } from "@/lib/game/atmosphere";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useGame } from "@/lib/game/store";
import World from "./World";
import Atmosphere from "./Atmosphere";
import Sky from "./Sky";
import Props from "./Props";
import NightStars from "./NightStars";
import SkillOrbs from "./SkillOrbs";
import Player from "./Player";
import CameraRig from "./CameraRig";

export default function Scene() {
  const quality = useGame((s) => s.quality);
  const setQuality = useGame((s) => s.setQuality);
  const high = quality === "high";
  // render-resolution cap that backs off automatically when the frame rate drops
  const [dprMax, setDprMax] = useState(1.5);
  const systemReduced = useReducedMotion();
  const motionPref = useGame((s) => s.motionPref);
  const reduced = systemReduced || motionPref === "reduce";

  useEffect(() => {
    motion.reduced = reduced;
  }, [reduced]);

  return (
    <Canvas
      dpr={high ? [1, dprMax] : [1, 1]}
      camera={{ fov: 50, near: 0.5, far: 300, position: [0, 12, 26] }}
      gl={{ antialias: high, powerPreference: "high-performance" }}
      aria-label="Interactive 3D portfolio world. Use the on-screen menu or Recruiter Mode for a non-game view."
    >
      <Atmosphere />

      {/* hand-built studio lighting: no HDRI download needed */}
      <Environment frames={1} resolution={high ? 128 : 32}>
        <Lightformer form="rect" intensity={2.2} color="#22d3ee" position={[-12, 6, -6]} scale={[24, 8, 1]} rotation-y={Math.PI / 2.5} />
        <Lightformer form="rect" intensity={2.2} color="#8b5cf6" position={[12, 5, 6]} scale={[24, 8, 1]} rotation-y={-Math.PI / 2.5} />
        <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[0, 14, 0]} rotation-x={Math.PI / 2} scale={[30, 30, 1]} />
      </Environment>

      <PerformanceMonitor
        onChange={({ factor }) => setDprMax(1 + 0.5 * factor)}
        onDecline={() => setQuality("low")}
      />

      <Suspense fallback={null}>
        <Sky />
        <World />
        <Props high={high && !reduced} />
        <SkillOrbs />
        <Player />
        <CameraRig />
        <NightStars high={high} still={reduced} />
        {high && !reduced && (
          <Sparkles count={120} scale={[70, 14, 70]} size={3} speed={0.3} color="#67e8f9" position={[0, 6, 0]} />
        )}
      </Suspense>

      {high && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.9} luminanceThreshold={1} luminanceSmoothing={0.2} mipmapBlur />
          <Vignette offset={0.5} darkness={0.6} />
        </EffectComposer>
      )}
    </Canvas>
  );
}

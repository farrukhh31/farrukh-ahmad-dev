"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTheme } from "next-themes";
import * as THREE from "three";
import { atmosphere, blend, mixNum, NUM, PAL } from "@/lib/game/atmosphere";

/**
 * Owns scene background, fog and the two main lights, and eases all of them
 * between the night and day palettes whenever the site theme changes.
 */
export default function Atmosphere() {
  const { resolvedTheme } = useTheme();
  const bg = useRef<THREE.Color>(null);
  const fog = useRef<THREE.Fog>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    const target = resolvedTheme === "light" ? 1 : 0;
    atmosphere.day += (target - atmosphere.day) * (1 - Math.exp(-dt * 2.5));
    const d = atmosphere.day;

    if (bg.current) blend(bg.current, PAL.bg, d);
    if (fog.current) {
      blend(fog.current.color, PAL.fog, d);
      fog.current.near = mixNum(NUM.fogNear, d);
      fog.current.far = mixNum(NUM.fogFar, d);
    }
    if (hemi.current) {
      blend(hemi.current.color, PAL.hemiSky, d);
      blend(hemi.current.groundColor, PAL.hemiGround, d);
      hemi.current.intensity = mixNum(NUM.hemiIntensity, d);
    }
    if (sun.current) {
      blend(sun.current.color, PAL.dirLight, d);
      sun.current.intensity = mixNum(NUM.dirIntensity, d);
    }
  });

  return (
    <>
      <color ref={bg} attach="background" args={["#030712"]} />
      <fog ref={fog} attach="fog" args={["#030712", 45, 130]} />
      <hemisphereLight ref={hemi} args={["#6d8bff", "#0a0f24", 0.9]} />
      <directionalLight ref={sun} position={[20, 30, 10]} intensity={0.8} color="#a5b4fc" />
    </>
  );
}

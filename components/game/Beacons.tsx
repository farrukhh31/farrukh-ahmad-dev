"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { motion } from "@/lib/game/atmosphere";
import { useGame } from "@/lib/game/store";
import { ZONES, type Zone } from "@/lib/game/zones";

/**
 * Every zone you have not found yet sends a tall pillar of light into the sky, so the next
 * place to go is visible from across the water. The pillar fades out once you discover it.
 */

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFade;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float h = vUv.y; // 0 at the base, 1 at the top
    float body = pow(1.0 - h, 1.6);
    float shimmer = 0.88 + 0.12 * sin(uTime * 1.6 + h * 9.0);
    gl_FragColor = vec4(uColor, body * 0.5 * shimmer * uFade);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function Beam({ zone }: { zone: Zone }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(zone.color) },
      uFade: { value: 1 },
      uTime: { value: 0 },
    }),
    [zone.color],
  );

  useFrame((state, rawDt) => {
    const u = mat.current?.uniforms;
    if (!u || !mesh.current) return;
    const seen = !!useGame.getState().visited[zone.id];
    const k = 1 - Math.exp(-Math.min(rawDt, 0.1) * 2.5);
    u.uFade.value += ((seen ? 0 : 1) - u.uFade.value) * k;
    u.uTime.value = motion.reduced ? 0 : state.clock.elapsedTime;
    mesh.current.visible = u.uFade.value > 0.01;
  });

  return (
    <mesh ref={mesh} position={[zone.position[0], 28, zone.position[2]]} renderOrder={-1} frustumCulled={false}>
      <cylinderGeometry args={[0.7, 1.5, 56, 24, 1, true]} />
      <shaderMaterial ref={mat} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function Beacons() {
  return (
    <group>
      {ZONES.filter((z) => z.id !== "plaza").map((z) => (
        <Beam key={z.id} zone={z} />
      ))}
    </group>
  );
}

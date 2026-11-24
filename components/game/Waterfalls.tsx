"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { atmosphere, blend, motion } from "@/lib/game/atmosphere";
import { PLATFORM_BY_ID } from "@/lib/game/layout";
import { ZONE_BY_ID, type ZoneId } from "@/lib/game/zones";

/** Water pouring off the outer rim of some platforms and vanishing into the clouds below. */

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    float x = vUv.x;
    float y = vUv.y; // 1 at the lip, 0 at the bottom
    float a = noise(vec2(x * 14.0, y * 3.0 + uTime * 1.8));
    float b = noise(vec2(x * 30.0 + 4.0, y * 6.0 + uTime * 3.2));
    float streak = smoothstep(0.3, 0.9, a * 0.6 + b * 0.5);
    float sides = smoothstep(0.0, 0.14, x) * smoothstep(1.0, 0.86, x);
    float down = smoothstep(0.0, 0.5, y);
    float alpha = (0.22 + 0.55 * streak) * sides * down * uOpacity;
    gl_FragColor = vec4(mix(uColor, vec3(1.0), streak * 0.55), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const FALLS: ZoneId[] = ["about", "skills", "quest", "resume", "cinema", "hire", "comms"];
const COLORS = [new THREE.Color("#4aa3ff"), new THREE.Color("#c9ecff")] as const;

function Fall({ id, uniforms }: { id: ZoneId; uniforms: { uColor: { value: THREE.Color }; uTime: { value: number }; uOpacity: { value: number } } }) {
  const zone = ZONE_BY_ID[id];
  const p = PLATFORM_BY_ID[id];
  const [x, , z] = zone.position;
  const d = Math.hypot(x, z) || 1;
  const ox = x / d;
  const oz = z / d;
  const rot = Math.atan2(ox, oz);
  const HEIGHT = 24;
  return (
    <mesh position={[p.x + ox * (p.r + 0.18), 0.05 - HEIGHT / 2, p.z + oz * (p.r + 0.18)]} rotation={[0, rot, 0]} renderOrder={-2} frustumCulled={false}>
      <planeGeometry args={[2.6, HEIGHT]} />
      <shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function Waterfalls() {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color() },
      uTime: { value: 0 },
      uOpacity: { value: 0.9 },
    }),
    [],
  );

  // one shared material state for all the falls: they only differ by position
  useFrame((state) => {
    blend(uniforms.uColor.value, COLORS, atmosphere.day);
    uniforms.uTime.value = motion.reduced ? 0 : state.clock.elapsedTime;
  });

  return (
    <group>
      {FALLS.map((id) => (
        <Fall key={id} id={id} uniforms={uniforms} />
      ))}
    </group>
  );
}

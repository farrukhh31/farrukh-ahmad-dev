"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { atmosphere, blend, motion, PAL } from "@/lib/game/atmosphere";
import { PLATFORMS } from "@/lib/game/layout";

/**
 * A sea of cloud far below the archipelago: it gives the islands something to float over,
 * hides the void, and catches a soft shadow under every platform.
 */

const vertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uShade;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uOpacity;
  uniform float uDark;
  uniform float uScale;
  varying vec3 vWorld;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(17.1, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 p = vWorld.xz * uScale + vec2(uTime * 0.012, uTime * 0.006) * uSpeed;
    float n = fbm(p);
    float n2 = fbm(p * 2.2 + 7.3);
    float density = smoothstep(0.34, 0.74, n * 0.8 + n2 * 0.35);
    float lit = clamp(n2 * 1.5 - 0.1, 0.0, 1.0);
    vec3 col = mix(uShade, uTop, lit);
    col = mix(col, uShade, uDark);
    float r = length(vWorld.xz);
    float edge = 1.0 - smoothstep(110.0, 250.0, r);
    gl_FragColor = vec4(col, density * edge * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function CloudLayer({ y, speed, opacity, dark, scale }: { y: number; speed: number; opacity: number; dark: number; scale: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color() },
      uShade: { value: new THREE.Color() },
      uTime: { value: 0 },
      uSpeed: { value: speed },
      uOpacity: { value: opacity },
      uDark: { value: dark },
      uScale: { value: scale },
    }),
    [speed, opacity, dark, scale],
  );

  useFrame((state) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    blend(u.uTop.value, PAL.cloudTop, atmosphere.day);
    blend(u.uShade.value, PAL.cloudShade, atmosphere.day);
    u.uTime.value = motion.reduced ? 0 : state.clock.elapsedTime;
  });

  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-4} frustumCulled={false}>
      <planeGeometry args={[520, 520]} />
      <shaderMaterial ref={mat} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite={false} />
    </mesh>
  );
}

const shadowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const shadowFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.0, 1.0, d));
    gl_FragColor = vec4(uColor, a * a * uStrength);
  }
`;

const SHADOW_COLORS = [new THREE.Color("#01030a"), new THREE.Color("#4f7396")] as const;

/** A soft blob of shade on the clouds under every platform: the cue that the islands really float. */
function CloudShadows() {
  const uniforms = useMemo(
    () =>
      PLATFORMS.map(() => ({
        uColor: { value: new THREE.Color() },
        uStrength: { value: 0.4 },
      })),
    [],
  );

  useFrame(() => {
    uniforms.forEach((u) => {
      blend(u.uColor.value, SHADOW_COLORS, atmosphere.day);
      u.uStrength.value = 0.45 - 0.12 * atmosphere.day;
    });
  });

  return (
    <group>
      {PLATFORMS.map((p, i) => (
        <mesh key={p.id} position={[p.x, -21.6, p.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-3} frustumCulled={false}>
          <planeGeometry args={[p.r * 3.2, p.r * 3.2]} />
          <shaderMaterial
            vertexShader={shadowVertex}
            fragmentShader={shadowFragment}
            uniforms={uniforms[i]}
            transparent
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function CloudSea({ high }: { high: boolean }) {
  return (
    <group>
      <CloudLayer y={-22} speed={1} opacity={0.96} dark={0} scale={0.018} />
      {high && <CloudLayer y={-31} speed={0.6} opacity={0.85} dark={0.4} scale={0.011} />}
      <CloudShadows />
    </group>
  );
}

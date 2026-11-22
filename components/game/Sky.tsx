"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { atmosphere, blend, mixNum, motion, NUM, PAL, SUN_DIR } from "@/lib/game/atmosphere";

const vertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform vec3 uSun;
  uniform vec3 uSunDir;
  uniform float uAurora;
  uniform float uDay;
  uniform float uTime;
  varying vec3 vDir;

  void main() {
    vec3 dir = normalize(vDir);
    float h = clamp(dir.y, -0.2, 1.0);
    vec3 col = mix(uBottom, uTop, smoothstep(-0.05, 0.75, h));

    // aurora ribbons (night only)
    float band = sin(dir.x * 5.0 + uTime * 0.15 + sin(dir.z * 3.0 + uTime * 0.25) * 1.6);
    float ribbon = smoothstep(0.55, 1.0, band) * smoothstep(0.05, 0.3, dir.y) * (1.0 - smoothstep(0.35, 0.8, dir.y));
    vec3 aur = mix(vec3(0.13, 0.83, 0.93), vec3(0.55, 0.36, 0.96), 0.5 + 0.5 * sin(dir.x * 3.0 + uTime * 0.2));
    col += aur * ribbon * 0.45 * uAurora;

    // sun (day) / moon (night) with soft halo
    float s = max(dot(dir, normalize(uSunDir)), 0.0);
    float disc = smoothstep(0.9975, 0.9992, s);
    float halo = pow(s, 28.0) * 0.55 + pow(s, 6.0) * 0.12;
    col += uSun * (disc * 1.4 + halo * mix(0.45, 1.0, uDay));

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export default function Sky() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uSun: { value: new THREE.Color() },
      uSunDir: { value: SUN_DIR.clone() },
      uAurora: { value: 1 },
      uDay: { value: 0 },
      uTime: { value: 0 },
    }),
    [],
  );

  useFrame((state) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    const d = atmosphere.day;
    blend(u.uTop.value, PAL.skyTop, d);
    blend(u.uBottom.value, PAL.skyBottom, d);
    blend(u.uSun.value, PAL.sun, d);
    u.uAurora.value = mixNum(NUM.aurora, d);
    u.uDay.value = d;
    u.uTime.value = motion.reduced ? 0 : state.clock.elapsedTime;
  });

  return (
    <mesh renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[240, 48, 32]} />
      <shaderMaterial
        ref={mat}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}

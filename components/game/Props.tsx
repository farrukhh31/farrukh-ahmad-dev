"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { atmosphere, blend, motion, PAL } from "@/lib/game/atmosphere";
import { useGame } from "@/lib/game/store";
import { distToBridge, PLATFORM_BY_ID, PLATFORMS } from "@/lib/game/layout";
import { ZONES, Zone } from "@/lib/game/zones";

/** Small deterministic RNG so the world looks identical on every load. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hot = (hex: string, k = 2.4) => new THREE.Color(hex).multiplyScalar(k);
const dummy = new THREE.Object3D();

/* ------------------------------ lamp posts ------------------------------ */

function Lamps() {
  const poles = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);

  const lamps = useMemo(() => {
    const out: { x: number; z: number; color: THREE.Color }[] = [];
    const pair = (ux: number, uz: number, d: number, color: THREE.Color) => {
      for (const side of [-1, 1]) {
        out.push({ x: ux * d + -uz * side * 1.55, z: uz * d + ux * side * 1.55, color });
      }
    };
    for (const z of ZONES) {
      if (z.id === "plaza") continue;
      const dist = Math.hypot(z.position[0], z.position[2]);
      const ux = z.position[0] / dist;
      const uz = z.position[2] / dist;
      const color = hot(z.color);
      // gate lamps where the bridge meets this zone's platform, then toward the building...
      const pr = PLATFORM_BY_ID[z.id].r;
      for (let d = dist - (pr - 1); d <= dist - z.blockRadius - 1.2; d += 3.4) pair(ux, uz, d, color);
      // ...and where the same bridge leaves the plaza
      for (let d = 6; d <= PLATFORM_BY_ID.plaza.r - 1; d += 3.4) pair(ux, uz, d, color);
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    if (!poles.current || !heads.current) return;
    lamps.forEach((l, i) => {
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.position.set(l.x, 1.1, l.z);
      dummy.updateMatrix();
      poles.current!.setMatrixAt(i, dummy.matrix);
      dummy.position.set(l.x, 2.35, l.z);
      dummy.updateMatrix();
      heads.current!.setMatrixAt(i, dummy.matrix);
      heads.current!.setColorAt(i, l.color);
    });
    poles.current.instanceMatrix.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
    if (heads.current.instanceColor) heads.current.instanceColor.needsUpdate = true;
  }, [lamps]);

  return (
    <group>
      <instancedMesh ref={poles} args={[undefined, undefined, lamps.length]}>
        <cylinderGeometry args={[0.06, 0.09, 2.2, 8]} />
        <meshStandardMaterial color="#1d2a4a" roughness={0.5} metalness={0.3} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, lamps.length]}>
        <sphereGeometry args={[0.2, 12, 12]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/* ------------------------------ rim crystals ----------------------------- */

function RimCrystals() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const COUNT = 44;

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const r = rng(11);
    const palette = [hot("#22d3ee", 1.8), hot("#8b5cf6", 1.8), hot("#2dd4bf", 1.8)];
    for (let i = 0; i < COUNT; i++) {
      // sit on a platform rim, but keep clear of the bridge entrances
      const plat = PLATFORMS[i % PLATFORMS.length];
      let cx = plat.x;
      let cz = plat.z;
      for (let tries = 0; tries < 8; tries++) {
        const a = r() * Math.PI * 2;
        const rad = plat.r - 0.9 - r() * 1.1;
        cx = plat.x + Math.cos(a) * rad;
        cz = plat.z + Math.sin(a) * rad;
        if (distToBridge(cx, cz) > 2.4) break;
      }
      const h = 0.7 + r() * 1.5;
      dummy.position.set(cx, h * 0.9, cz);
      dummy.rotation.set((r() - 0.5) * 0.4, r() * Math.PI, (r() - 0.5) * 0.4);
      dummy.scale.set(0.3 + r() * 0.35, h, 0.3 + r() * 0.35);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, palette[i % palette.length]);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/* --------------------- distant floating islands (skyline) --------------------- */

interface Far {
  x: number;
  y: number;
  z: number;
  r: number;
  phase: number;
  color: THREE.Color;
}

function FarIslands() {
  const tops = useRef<THREE.InstancedMesh>(null);
  const cones = useRef<THREE.InstancedMesh>(null);
  const rims = useRef<THREE.InstancedMesh>(null);
  const topMat = useRef<THREE.MeshStandardMaterial>(null);
  const coneMat = useRef<THREE.MeshStandardMaterial>(null);

  const islands = useMemo<Far[]>(() => {
    const r = rng(5);
    const colors = [hot("#22d3ee", 2), hot("#8b5cf6", 2), hot("#f472b6", 2), hot("#34d399", 2)];
    return Array.from({ length: 11 }, (_, i) => {
      const a = (i / 11) * Math.PI * 2 + r() * 0.35;
      const dist = 78 + r() * 40;
      return {
        x: Math.cos(a) * dist,
        z: Math.sin(a) * dist,
        y: -6 + r() * 26,
        r: 5 + r() * 9,
        phase: r() * Math.PI * 2,
        color: colors[i % colors.length],
      };
    });
  }, []);

  useLayoutEffect(() => {
    if (!rims.current) return;
    islands.forEach((_, i) => rims.current!.setColorAt(i, islands[i].color));
    if (rims.current.instanceColor) rims.current.instanceColor.needsUpdate = true;
  }, [islands]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!tops.current || !cones.current || !rims.current) return;
    islands.forEach((il, i) => {
      const y = il.y + (motion.reduced ? 0 : Math.sin(t * 0.4 + il.phase) * 0.8);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(il.r, 1, il.r);
      dummy.position.set(il.x, y, il.z);
      dummy.updateMatrix();
      tops.current!.setMatrixAt(i, dummy.matrix);

      dummy.rotation.set(Math.PI, 0, 0);
      dummy.scale.set(il.r * 0.97, il.r * 0.9, il.r * 0.97);
      dummy.position.set(il.x, y - 0.3 - il.r * 0.45, il.z);
      dummy.updateMatrix();
      cones.current!.setMatrixAt(i, dummy.matrix);

      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.scale.set(il.r, il.r, il.r);
      dummy.position.set(il.x, y + 0.32, il.z);
      dummy.updateMatrix();
      rims.current!.setMatrixAt(i, dummy.matrix);
    });
    tops.current.instanceMatrix.needsUpdate = true;
    cones.current.instanceMatrix.needsUpdate = true;
    rims.current.instanceMatrix.needsUpdate = true;

    const tmp = topMat.current?.color;
    if (tmp) blend(tmp, PAL.rock, atmosphere.day);
    if (coneMat.current) blend(coneMat.current.color, PAL.rock, atmosphere.day);
  });

  const n = islands.length;
  return (
    <group>
      <instancedMesh ref={tops} args={[undefined, undefined, n]} frustumCulled={false}>
        <cylinderGeometry args={[1, 0.95, 0.6, 24]} />
        <meshStandardMaterial ref={topMat} color="#0e1630" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={cones} args={[undefined, undefined, n]} frustumCulled={false}>
        <coneGeometry args={[1, 1, 7]} />
        <meshStandardMaterial ref={coneMat} color="#0e1630" roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={rims} args={[undefined, undefined, n]} frustumCulled={false}>
        <torusGeometry args={[0.98, 0.012, 6, 48]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/* ------------------------- drifting rocks under the island ------------------------- */

function DriftRocks() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const rocks = useMemo(() => {
    const r = rng(23);
    return Array.from({ length: 16 }, () => ({
      a: r() * Math.PI * 2,
      rad: 12 + r() * 26,
      y: -9 - r() * 14,
      s: 0.5 + r() * 1.6,
      speed: (0.03 + r() * 0.05) * (r() > 0.5 ? 1 : -1),
      spin: r() * 0.4,
    }));
  }, []);

  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    rocks.forEach((k, i) => {
      const a = k.a + t * k.speed;
      dummy.position.set(Math.cos(a) * k.rad, k.y + Math.sin(t * 0.5 + i) * 0.5, Math.sin(a) * k.rad);
      dummy.rotation.set(t * k.spin, t * k.spin * 0.7, 0);
      dummy.scale.setScalar(k.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, rocks.length]} frustumCulled={false}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#1a2545" roughness={0.9} flatShading />
    </instancedMesh>
  );
}

/* ------------------------------ zone light beams ------------------------------ */

function Beam({ zone }: { zone: Zone }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const color = useMemo(() => hot(zone.color, 1.6), [zone.color]);

  useFrame((s) => {
    if (!mat.current) return;
    const active = useGame.getState().activeZone === zone.id;
    const base = active ? 0.16 : 0.06;
    mat.current.opacity = base + (motion.reduced ? 0 : Math.sin(s.clock.elapsedTime * 1.5 + zone.position[0]) * 0.012);
  });

  return (
    <mesh position={[zone.position[0], 22, zone.position[2]]}>
      <cylinderGeometry args={[0.5, 1.8, 44, 24, 1, true]} />
      <meshBasicMaterial
        ref={mat}
        color={color}
        transparent
        opacity={0.06}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}

export default function Props({ high }: { high: boolean }) {
  return (
    <group>
      <Lamps />
      <RimCrystals />
      <FarIslands />
      {high && <DriftRocks />}
      {ZONES.map((z) => (
        <Beam key={z.id} zone={z} />
      ))}
    </group>
  );
}

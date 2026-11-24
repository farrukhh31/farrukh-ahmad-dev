"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

import { atmosphere, blend } from "@/lib/game/atmosphere";

/** Small drifting islands scattered around the archipelago. They are scenery: you cannot walk on them. */

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const c = (hex: string) => new THREE.Color(hex);
const TOP = [c("#1d3a4c"), c("#a7dcc0")] as const;
const ROCK = [c("#18204a"), c("#b9aecb")] as const;
const LEAF = [c("#1b6a63"), c("#72cf9c")] as const;
const TRUNK = [c("#2e2538"), c("#8c705c")] as const;

const GEO = {
  top: new THREE.CylinderGeometry(1, 0.9, 0.5, 14),
  rock: new THREE.ConeGeometry(0.9, 1.7, 7),
  trunk: new THREE.CylinderGeometry(0.05, 0.075, 0.42, 6),
  leaf: new THREE.ConeGeometry(0.3, 0.62, 7),
};

interface Tree {
  ox: number;
  oz: number;
  h: number;
}
interface Islet {
  x: number;
  y: number;
  z: number;
  s: number;
  speed: number;
  trees: Tree[];
}

export default function Islets({ high }: { high: boolean }) {
  const mats = useMemo(
    () => ({
      top: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
      rock: new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }),
      leaf: new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }),
      trunk: new THREE.MeshStandardMaterial({ roughness: 1 }),
    }),
    [],
  );

  const islets = useMemo<Islet[]>(() => {
    const r = rng(77);
    const count = high ? 14 : 6;
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + r() * 0.35;
      const dist = 58 + r() * 55;
      const treeCount = high ? Math.floor(r() * 3) : 0;
      return {
        x: Math.sin(a) * dist,
        z: -Math.cos(a) * dist,
        y: -4 + r() * 16,
        s: 1.6 + r() * 3.2,
        speed: 0.6 + r() * 0.8,
        trees: Array.from({ length: treeCount }, () => ({ ox: (r() - 0.5) * 1.1, oz: (r() - 0.5) * 1.1, h: 0.8 + r() * 0.7 })),
      };
    });
  }, [high]);

  useFrame(() => {
    const d = atmosphere.day;
    blend(mats.top.color, TOP, d);
    blend(mats.rock.color, ROCK, d);
    blend(mats.leaf.color, LEAF, d);
    blend(mats.trunk.color, TRUNK, d);
  });

  return (
    <group>
      {islets.map((it, i) => (
        <Float key={i} speed={it.speed} rotationIntensity={0.08} floatIntensity={1.1} floatingRange={[-0.6, 0.6]}>
          <group position={[it.x, it.y, it.z]} scale={it.s} rotation={[0, i * 1.3, 0]}>
            <mesh geometry={GEO.top} material={mats.top} />
            <mesh geometry={GEO.rock} material={mats.rock} position={[0, -1.1, 0]} rotation={[Math.PI, 0, 0]} />
            {it.trees.map((t, k) => (
              <group key={k} position={[t.ox, 0.25, t.oz]} scale={t.h}>
                <mesh geometry={GEO.trunk} material={mats.trunk} position={[0, 0.21, 0]} />
                <mesh geometry={GEO.leaf} material={mats.leaf} position={[0, 0.62, 0]} />
                <mesh geometry={GEO.leaf} material={mats.leaf} position={[0, 0.86, 0]} scale={0.7} />
              </group>
            ))}
          </group>
        </Float>
      ))}
    </group>
  );
}

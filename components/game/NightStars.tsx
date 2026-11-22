"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { atmosphere } from "@/lib/game/atmosphere";

/** Stars fade away as the theme moves toward day. */
export default function NightStars({ high, still }: { high: boolean; still?: boolean }) {
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    if (group.current) group.current.visible = atmosphere.day < 0.6;
  });

  return (
    <group ref={group}>
      <Stars radius={110} depth={60} count={high ? 3500 : 1200} factor={4} fade speed={still ? 0 : 0.6} />
    </group>
  );
}

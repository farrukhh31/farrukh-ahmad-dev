"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * Stand-in character used until the Blender GLB (Step 3) is dropped in.
 * Faces +Z at heading 0, feet at y = 0.
 */
export default function AvatarPlaceholder() {
  const glow = useMemo(() => new THREE.Color("#22d3ee").multiplyScalar(2.5), []);

  return (
    <group>
      {/* legs + torso */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <capsuleGeometry args={[0.42, 0.9, 8, 16]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.35} metalness={0.2} />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.95, 0]} castShadow>
        <sphereGeometry args={[0.5, 24, 24]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* visor */}
      <mesh position={[0, 1.98, 0.3]}>
        <boxGeometry args={[0.62, 0.2, 0.3]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>
      {/* chest core */}
      <mesh position={[0, 1.25, 0.4]}>
        <circleGeometry args={[0.1, 16]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>
      {/* ground halo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.7, 0.85, 40]} />
        <meshBasicMaterial color={glow} toneMapped={false} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

import { skills } from "@/components/Skills/skillsData";
import { CATEGORY_ORDER, categoryColor } from "@/components/Skills/categoryTheme";
import { motion } from "@/lib/game/atmosphere";
import { playerState } from "@/lib/game/input";
import { useGame } from "@/lib/game/store";
import { ZONE_BY_ID } from "@/lib/game/zones";
import { FONT_BOLD, FONT_MED } from "./Glow";

const COLLECT_RADIUS = 1.5;
const dummy = new THREE.Object3D();
const hoverPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.5);
const hit = new THREE.Vector3();
/** how far (metres) the mouse pointer influences the orbs, and how long it counts after the last move */
const POINTER_RADIUS = 3.4;
const POINTER_MEMORY_MS = 2500;

/**
 * One collectible orb per skill, laid out in rings around the Skill Grove and
 * grouped by category. Walk into an orb to collect it (+10 XP).
 */
export default function SkillOrbs() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const label = useRef<THREE.Group>(null);
  const shrink = useRef<number[]>([]);
  /** per-orb 0..1 "the mouse is close" amount, eased so orbs glide instead of snapping */
  const excite = useRef<number[]>([]);
  const lastMouseMove = useRef(0);
  const [near, setNear] = useState<string | null>(null);

  const zone = ZONE_BY_ID.skills;

  const orbs = useMemo(() => {
    const sorted = [...skills].sort(
      (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
    );
    const rings = [
      { r: 4.7, n: 11, y: 1.2 },
      { r: 6.4, n: 12, y: 1.5 },
      { r: 8.1, n: Math.max(0, sorted.length - 23), y: 1.8 },
    ];
    const out: { id: string; name: string; level: string; x: number; y: number; z: number; color: THREE.Color; hex: string }[] = [];
    let i = 0;
    rings.forEach((ring, ri) => {
      for (let k = 0; k < ring.n && i < sorted.length; k++, i++) {
        const sk = sorted[i];
        const a = (k / ring.n) * Math.PI * 2 + ri * 0.35;
        const hex = categoryColor(sk.category);
        out.push({
          id: sk.id,
          name: sk.name,
          level: sk.level,
          x: zone.position[0] + Math.cos(a) * ring.r,
          y: ring.y,
          z: zone.position[2] + Math.sin(a) * ring.r,
          color: new THREE.Color(hex).multiplyScalar(2.2),
          hex,
        });
      }
    });
    return out;
  }, [zone]);

  // only a real mouse counts: on touch screens the "pointer" would stay stuck where the last tap was
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse") lastMouseMove.current = performance.now();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    orbs.forEach((o, i) => m.setColorAt(i, o.color));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    shrink.current = orbs.map(() => 1);
    excite.current = orbs.map(() => 0);
  }, [orbs]);

  useFrame((state, rawDelta) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(rawDelta, 0.05);
    const t = state.clock.elapsedTime;
    const game = useGame.getState();

    let nearest = -1;
    let best = 7;

    // where is the mouse pointing, at orb height?
    let pointerOn = false;
    if (!motion.reduced && performance.now() - lastMouseMove.current < POINTER_MEMORY_MS) {
      state.raycaster.setFromCamera(state.pointer, state.camera);
      pointerOn = state.raycaster.ray.intersectPlane(hoverPlane, hit) !== null;
    }
    let hovered = -1;
    let hoveredDist = 1.3;

    orbs.forEach((o, i) => {
      const collected = !!game.skills[o.id];
      const target = collected ? 0 : 1;
      const cur = shrink.current[i] ?? 1;
      const next = cur + (target - cur) * (1 - Math.exp(-dt * 12));
      shrink.current[i] = next;

      // mouse interaction: orbs near the pointer lift, swell and drift slightly away from it
      const dx = o.x - hit.x;
      const dz = o.z - hit.z;
      const dist = pointerOn ? Math.hypot(dx, dz) : Infinity;
      const want = !collected && dist < POINTER_RADIUS ? (1 - dist / POINTER_RADIUS) ** 2 : 0;
      const ex = (excite.current[i] ?? 0) + (want - (excite.current[i] ?? 0)) * (1 - Math.exp(-dt * 9));
      excite.current[i] = ex;
      if (!collected && dist < hoveredDist) {
        hoveredDist = dist;
        hovered = i;
      }
      const push = dist > 0.001 && Number.isFinite(dist) ? (0.6 * ex) / dist : 0;

      const bob = motion.reduced ? 0 : Math.sin(t * 1.6 + i) * 0.18;
      dummy.position.set(o.x + dx * push, o.y + bob + ex * 0.6, o.z + dz * push);
      dummy.rotation.set(0, motion.reduced ? i : t * (0.8 + ex * 3) + i, 0);
      dummy.scale.setScalar(Math.max(next, 0.0001) * (collected ? 1.25 : 1) * (1 + ex * 0.55));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);

      if (!collected && !game.openPanel) {
        const d = Math.hypot(playerState.x - o.x, playerState.z - o.z);
        if (d < COLLECT_RADIUS) game.collectSkill(o.id, o.name);
        else if (d < best) {
          best = d;
          nearest = i;
        }
      }
    });
    m.instanceMatrix.needsUpdate = true;

    // floating name tag: the orb under the mouse wins, otherwise the one closest to the player
    if (hovered >= 0) nearest = hovered;
    const id = nearest >= 0 ? orbs[nearest].id : null;
    if (id !== near) setNear(id);
    if (label.current && nearest >= 0) {
      const o = orbs[nearest];
      label.current.position.set(o.x, o.y + 1.1, o.z);
    }
  });

  const nearOrb = orbs.find((o) => o.id === near);

  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, orbs.length]} frustumCulled={false}>
        <icosahedronGeometry args={[0.38, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      <group ref={label} visible={!!nearOrb}>
        <Billboard>
          {nearOrb && (
            <>
              <Text font={FONT_BOLD} fontSize={0.34} color={nearOrb.hex} anchorX="center" anchorY="middle" material-toneMapped={false}>
                {nearOrb.name.toUpperCase()}
              </Text>
              <Text font={FONT_MED} fontSize={0.2} position={[0, -0.38, 0]} color="#cbd5e1" anchorX="center" anchorY="middle">
                {nearOrb.level.toUpperCase()}
              </Text>
            </>
          )}
        </Billboard>
      </group>
    </group>
  );
}

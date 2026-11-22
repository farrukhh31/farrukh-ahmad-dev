"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { motion } from "@/lib/game/atmosphere";
import { playerState } from "@/lib/game/input";
import { ZONES } from "@/lib/game/zones";

const BLEND_START = 17; // distance at which the camera starts swinging round
const BLEND_RANGE = 8;

const shortest = (from: number, to: number) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/**
 * Third-person chase camera. Near a zone it orbits to the plaza side of the
 * player, so you always look at the FRONT of the building you are visiting.
 * Movement is camera-relative (see Player), so controls stay intuitive.
 */
export default function CameraRig() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const lookNow = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const aspect = size.width / size.height;
    const pull = aspect < 1 ? 1 + (1 - aspect) * 0.9 : 1;

    // find the nearest building and how strongly it should steer the camera
    let nearest = Infinity;
    let zoneYaw = 0;
    for (const z of ZONES) {
      if (z.id === "plaza") continue;
      const d = Math.hypot(playerState.x - z.position[0], playerState.z - z.position[2]);
      if (d < nearest) {
        nearest = d;
        zoneYaw = Math.atan2(-z.position[0], -z.position[2]); // direction zone -> plaza
      }
    }
    const t = Math.min(1, Math.max(0, (BLEND_START - nearest) / BLEND_RANGE));
    const w = t * t * (3 - 2 * t);
    const targetYaw = shortest(0, zoneYaw) * w;

    const yawRate = motion.reduced ? 14 : 2.6;
    playerState.camYaw += shortest(playerState.camYaw, targetYaw) * (1 - Math.exp(-dt * yawRate));

    const sy = Math.sin(playerState.camYaw);
    const cy = Math.cos(playerState.camYaw);

    desired.set(playerState.x + sy * 15 * pull, 12 * pull, playerState.z + cy * 15 * pull);
    camera.position.lerp(desired, 1 - Math.exp(-dt * (motion.reduced ? 14 : 4.5)));

    // aim further ahead (and higher) near a building so its full height is framed
    const ahead = 2 + 5.5 * w;
    look.set(playerState.x - sy * ahead, 1.2 + 2.2 * w, playerState.z - cy * ahead);
    lookNow.lerp(look, 1 - Math.exp(-dt * 7));
    camera.lookAt(lookNow);
  });

  return null;
}

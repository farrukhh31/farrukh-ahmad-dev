"use client";

import { Suspense, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import {
  RUN_MULTIPLIER_KEYS,
  RUN_MULTIPLIER_TOUCH,
  WALK_SPEED_KEYS,
  WALK_SPEED_TOUCH,
  isRunning,
  playerState,
  readMoveVector,
} from "@/lib/game/input";
import { useGame } from "@/lib/game/store";
import { isWalkable } from "@/lib/game/layout";
import { isZoneId, travelToZone } from "@/lib/game/travel";
import { SPAWN, ZONES, ZoneId } from "@/lib/game/zones";
import Avatar from "./Avatar";
import AvatarPlaceholder from "./AvatarPlaceholder";

const PLAYER_RADIUS = 0.6;

const shortestAngle = (from: number, to: number) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export default function Player() {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const active = useRef<ZoneId | null>(null);
  const lastInteract = useRef(useGame.getState().interactTick);

  useEffect(() => {
    playerState.x = SPAWN[0];
    playerState.z = SPAWN[1];
    playerState.heading = 0; // face the camera so the intro wave is visible
    playerState.teleportTo = null;
    // deep link: /play?zone=skills starts the player at that platform
    const want = new URLSearchParams(window.location.search).get("zone");
    if (want && isZoneId(want)) travelToZone(want);
  }, []);

  useFrame((_state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const game = useGame.getState();
    const locked = game.openPanel !== null;

    // fast travel
    if (playerState.teleportTo) {
      [playerState.x, playerState.z] = playerState.teleportTo;
      playerState.teleportTo = null;
    }

    // movement
    const intent = locked ? { x: 0, z: 0, touch: false } : readMoveVector();
    // rotate the input so "up" always means "away from the camera"
    const cy = Math.cos(playerState.camYaw);
    const sy = Math.sin(playerState.camYaw);
    const move = { x: intent.x * cy + intent.z * sy, z: -intent.x * sy + intent.z * cy };
    const mag = Math.hypot(move.x, move.z);
    playerState.moving = mag > 0.05;
    if (!playerState.moving) playerState.speed = 0;

    if (playerState.moving) {
      const run = isRunning();
      const walk = intent.touch ? WALK_SPEED_TOUCH : WALK_SPEED_KEYS;
      const boost = intent.touch ? RUN_MULTIPLIER_TOUCH : RUN_MULTIPLIER_KEYS;
      const speed = walk * (run ? boost : 1);
      playerState.speed = speed * Math.min(1, mag);
      let nx = playerState.x + move.x * speed * dt;
      let nz = playerState.z + move.z * speed * dt;

      // slide around building footprints
      for (const zone of ZONES) {
        const dx = nx - zone.position[0];
        const dz = nz - zone.position[2];
        const dist = Math.hypot(dx, dz);
        const min = zone.blockRadius + PLAYER_RADIUS;
        if (dist < min && dist > 0.0001) {
          nx = zone.position[0] + (dx / dist) * min;
          nz = zone.position[2] + (dz / dist) * min;
        }
      }

      // stay on the platforms and bridges; slide along an edge instead of sticking to it
      if (!isWalkable(nx, nz)) {
        if (isWalkable(nx, playerState.z)) nz = playerState.z;
        else if (isWalkable(playerState.x, nz)) nx = playerState.x;
        else {
          nx = playerState.x;
          nz = playerState.z;
        }
      }

      playerState.x = nx;
      playerState.z = nz;

      const target = Math.atan2(move.x, move.z);
      playerState.heading +=
        shortestAngle(playerState.heading, target) * (1 - Math.exp(-dt * 14));
    }

    // apply to scene
    if (root.current) {
      root.current.position.set(playerState.x, 0, playerState.z);
      root.current.rotation.y = playerState.heading;
    }
    // nearest zone trigger
    let nearest: ZoneId | null = null;
    let best = Infinity;
    for (const zone of ZONES) {
      const d = Math.hypot(
        playerState.x - zone.position[0],
        playerState.z - zone.position[2],
      );
      if (d < zone.triggerRadius && d < best) {
        best = d;
        nearest = zone.id;
      }
    }
    if (nearest !== active.current) {
      active.current = nearest;
      game.setActiveZone(nearest);
      if (nearest) game.visitZone(nearest);
    }

    // interact
    if (game.interactTick !== lastInteract.current) {
      lastInteract.current = game.interactTick;
      if (active.current && !locked) game.openZonePanel(active.current);
    }
  });

  return (
    <group ref={root}>
      {/* soft key light that travels with the player */}
      <pointLight position={[0, 3.2, 3]} intensity={55} distance={11} color="#dbeafe" />
      <group ref={body}>
        {/* capsule stand-in shows only while the GLB streams in */}
        <Suspense fallback={<AvatarPlaceholder />}>
          <Avatar />
        </Suspense>
      </group>
    </group>
  );
}

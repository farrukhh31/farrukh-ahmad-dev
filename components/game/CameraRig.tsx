"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { motion } from "@/lib/game/atmosphere";
import { input, isRunning, playerState } from "@/lib/game/input";
import { useGame } from "@/lib/game/store";
import { ZONE_BY_ID, type ZoneId } from "@/lib/game/zones";

/* ------------------------------ tuning ------------------------------ */

/** Orbit radius (player -> camera) at zoom 0 (closest) and zoom 1 (furthest). */
const RADIUS_MIN = 7;
const RADIUS_MAX = 34;
/** Camera elevation angle in degrees: low and cinematic when close, high and tactical when far. */
const PITCH_NEAR = 18;
const PITCH_FAR = 52;
const ZOOM_DEFAULT = 0.42;

const ORBIT_SPEED = 1.9; // rad/s while an arrow key is held
const ZOOM_SPEED = 0.7; // zoom units/s while an arrow key is held
const WHEEL_ZOOM = 0.0011; // zoom units per wheel pixel
const DRAG_ORBIT = 0.0055; // rad per pixel of mouse drag
const DRAG_ORBIT_TOUCH = 0.0072; // fingers travel less than a mouse, so each pixel turns the view a bit more

const BASE_FOV = 50;
const RUN_FOV = 56;

// subtle mouse parallax (world units)
const HOVER_SIDE = 1.5;
const HOVER_LIFT = 0.6;
const HOVER_LOOK = 1.0;

/** The part of each building worth looking at, and how big it is (width x height) for framing. */
const FOCUS: Partial<Record<ZoneId, { y: number; w: number; h: number }>> = {
  cinema: { y: 4, w: 11.5, h: 6.8 }, // 7.6 x 4.4 screen plus margin
  plaza: { y: 4.8, w: 10, h: 6 },
  about: { y: 5.2, w: 9, h: 11.5 }, // the Origin Tower is tall: frame the shaft and the crystal together
};
const DEFAULT_FOCUS = { y: 3.6, w: 10, h: 8 };

/* ------------------------------ helpers ----------------------------- */

const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const shortest = (from: number, to: number) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
const radiusAt = (zoom: number) => RADIUS_MIN + (RADIUS_MAX - RADIUS_MIN) * Math.pow(zoom, 1.15);
const pitchAt = (zoom: number) => THREE.MathUtils.degToRad(PITCH_NEAR + (PITCH_FAR - PITCH_NEAR) * Math.pow(zoom, 0.85));
const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
};

/**
 * Third-person camera.
 *
 *  - Arrow Left / Right orbit around the player, Arrow Up / Down zoom in / out
 *    (mouse wheel zooms, dragging the scene orbits, C resets the view).
 *  - W A S D move the player relative to the camera (see Player).
 *  - Visiting the Promo Cinema glides the camera to the FRONT of the video board, framed so the whole
 *    screen is visible. Arrow keys still let you nudge the view a little while you watch.
 *  - Opening any other zone's panel swings the camera to that building's front.
 *  - When a special shot ends the camera stays where it is: controls never change under your fingers.
 */
export default function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const dom = useThree((s) => s.gl.domElement);

  const pos = useMemo(() => new THREE.Vector3(), []);
  const chasePos = useMemo(() => new THREE.Vector3(), []);
  const shotPos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const chaseLook = useMemo(() => new THREE.Vector3(), []);
  const shotLook = useMemo(() => new THREE.Vector3(), []);
  const lookNow = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const booted = useRef(false);

  // user-controlled view
  const yawTarget = useRef(0);
  const zoomTarget = useRef(ZOOM_DEFAULT);
  const zoom = useRef(ZOOM_DEFAULT);
  const nudge = useRef(0); // extra yaw the player adds while a shot is active (clamped)
  const prevShot = useRef(false);
  const shotActive = useRef(false);
  const lastTarget = useRef(0);

  // shot state
  const shotZone = useRef<ZoneId | null>(null);
  const shot = useRef(0); // 0..1  glide to the front of the building
  const push = useRef(0); // 0..1  closer while a panel is open
  const lead = useRef({ x: 0, z: 0 });
  const fov = useRef(BASE_FOV);

  // mouse parallax (real mouse only)
  const hover = useRef({ x: 0, y: 0 });
  const hoverS = useRef({ x: 0, y: 0 });

  /* wheel zoom, drag orbit, reset key */
  useEffect(() => {
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomTarget.current = clamp(zoomTarget.current + e.deltaY * WHEEL_ZOOM, 0, 1);
    };
    let dragging = false;
    let lastX = 0;
    // two-finger pinch zoom (touch): track every finger that is on the canvas
    const fingers = new Map<number, { x: number; y: number }>();
    let pinchStart = 0;
    let pinchZoom = 0;
    const spread = () => {
      const [a, b] = [...fingers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.pointerType === "touch") {
        fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (fingers.size === 2) {
          pinchStart = spread();
          pinchZoom = zoomTarget.current;
        }
      }
      dragging = true;
      lastX = e.clientX;
    };
    const drag = (e: PointerEvent) => {
      if (e.pointerType !== "touch") {
        hover.current.x = (e.clientX / window.innerWidth) * 2 - 1;
        hover.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
      }
      if (e.pointerType === "touch" && fingers.has(e.pointerId)) {
        fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (fingers.size === 2 && pinchStart > 0) {
          const g = useGame.getState();
          if (!g.openPanel && !g.helpOpen && !g.settingsOpen) {
            // fingers apart = zoom in, together = zoom out
            zoomTarget.current = clamp(pinchZoom - (spread() / pinchStart - 1) * 0.7, 0, 1);
          }
          lastX = e.clientX;
          return;
        }
      }
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      const g = useGame.getState();
      if (g.openPanel || g.helpOpen || g.settingsOpen) return;
      const k = e.pointerType === "touch" ? DRAG_ORBIT_TOUCH : DRAG_ORBIT;
      if (shotActive.current) nudge.current = clamp(nudge.current + dx * k, -0.9, 0.9);
      else yawTarget.current += dx * k;
    };
    const up = (e: PointerEvent) => {
      fingers.delete(e.pointerId);
      if (fingers.size < 2) pinchStart = 0;
      if (e.pointerType !== "touch" || fingers.size === 0) dragging = false;
      else lastX = [...fingers.values()][0].x; // the remaining finger carries on orbiting from where it is
    };
    const leave = () => {
      hover.current.x = 0;
      hover.current.y = 0;
    };
    const key = (e: KeyboardEvent) => {
      if (e.code !== "KeyC" || e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      yawTarget.current = 0;
      zoomTarget.current = ZOOM_DEFAULT;
      nudge.current = 0;
    };
    dom.addEventListener("wheel", wheel, { passive: false });
    dom.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", drag, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", key);
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      dom.removeEventListener("wheel", wheel);
      dom.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", drag);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", key);
      document.documentElement.removeEventListener("mouseleave", leave);
    };
  }, [dom]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const reduced = motion.reduced;
    const game = useGame.getState();
    const uiOpen = game.openPanel !== null || game.helpOpen || game.settingsOpen;
    const aspect = size.width / size.height;
    const narrow = aspect < 1 ? 1 + (1 - aspect) * 0.9 : 1;

    /* ---- which shot, if any, is the camera in? ---- */
    // The cinema frames its screen as soon as you are in its zone. Other buildings only do it while their panel is open.
    const want: ZoneId | null =
      game.openPanel && game.openPanel !== "plaza" ? game.openPanel : game.activeZone === "cinema" ? "cinema" : null;
    if (want) shotZone.current = want;
    const fz = shotZone.current ? ZONE_BY_ID[shotZone.current] : null;
    const kShot = 1 - Math.exp(-dt * (reduced ? 14 : 2.2));
    shot.current += ((want ? 1 : 0) - shot.current) * kShot;
    push.current += ((game.openPanel ? 1 : 0) - push.current) * kShot;
    const inShot = !!want && !!fz;
    shotActive.current = inShot;
    const sw = smoothstep(clamp(shot.current, 0, 1));

    /* ---- keyboard: arrows orbit + zoom (ignored while a dialog or panel is open) ---- */
    if (!uiOpen) {
      const k = input.keys;
      const orbit = (k.has("ArrowLeft") ? 1 : 0) - (k.has("ArrowRight") ? 1 : 0);
      const zoomDir = (k.has("ArrowDown") ? 1 : 0) - (k.has("ArrowUp") ? 1 : 0); // up = zoom in
      if (orbit) {
        if (inShot) nudge.current = clamp(nudge.current - orbit * ORBIT_SPEED * 0.6 * dt, -0.9, 0.9);
        else yawTarget.current -= orbit * ORBIT_SPEED * dt;
      }
      if (zoomDir) zoomTarget.current = clamp(zoomTarget.current + zoomDir * ZOOM_SPEED * dt, 0, 1);
    }
    zoom.current = damp(zoom.current, zoomTarget.current, reduced ? 20 : 7, dt);

    /* ---- yaw: user orbit normally, the building's front during a shot ---- */
    let target = yawTarget.current;
    if (inShot && fz) {
      target = Math.atan2(-fz.position[0], -fz.position[2]) + nudge.current; // direction building -> plaza
      lastTarget.current = target;
    }
    if (prevShot.current && !inShot) {
      // shot over: keep the view exactly where it is, so W A S D keep meaning the same thing
      yawTarget.current = lastTarget.current;
      nudge.current = 0;
      target = yawTarget.current;
    }
    prevShot.current = inShot;
    playerState.camYaw += shortest(playerState.camYaw, target) * (1 - Math.exp(-dt * (reduced ? 14 : inShot ? 3.2 : 9)));
    const yaw = playerState.camYaw;
    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);

    /* ---- mouse parallax: tiny, and quiet near panels and shots ---- */
    const live = !reduced && !uiOpen;
    hoverS.current.x = damp(hoverS.current.x, live ? hover.current.x : 0, 3.2, dt);
    hoverS.current.y = damp(hoverS.current.y, live ? hover.current.y : 0, 3.2, dt);
    const calm = 1 - 0.85 * sw;
    const hx = hoverS.current.x * calm;
    const hy = hoverS.current.y * calm;
    const rx = cy; // camera-right on the ground plane
    const rz = -sy;

    /* ---- chase pose: orbit around the player, with a little look-ahead ---- */
    const run = isRunning() && playerState.moving;
    const radius = radiusAt(zoom.current) * narrow;
    const pitch = pitchAt(zoom.current);
    const cp = Math.cos(pitch);
    lead.current.x = damp(lead.current.x, playerState.moving ? Math.sin(playerState.heading) * 1.6 : 0, 2.2, dt);
    lead.current.z = damp(lead.current.z, playerState.moving ? Math.cos(playerState.heading) * 1.6 : 0, 2.2, dt);
    const px = playerState.x + lead.current.x * 0.5;
    const pz = playerState.z + lead.current.z * 0.5;
    chaseLook.set(px, 1.5, pz);
    chasePos.set(
      px + sy * radius * cp + rx * hx * HOVER_SIDE,
      Math.max(1.4, 1.5 + Math.sin(pitch) * radius - hy * HOVER_LIFT),
      pz + cy * radius * cp + rz * hx * HOVER_SIDE,
    );
    chaseLook.x += rx * hx * HOVER_LOOK;
    chaseLook.z += rz * hx * HOVER_LOOK;
    chaseLook.y += hy * HOVER_LIFT;

    /* ---- shot pose: in front of the building, far enough back that the whole board fits ---- */
    if (fz) {
      const f = FOCUS[fz.id] ?? DEFAULT_FOCUS;
      const vTan = Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2));
      const hTan = vTan * aspect;
      const fit = Math.max(f.h / (2 * vTan), f.w / (2 * hTan)); // distance at which the board just fits
      const scale = clamp(radiusAt(zoom.current) / radiusAt(ZOOM_DEFAULT), 0.6, 1.7);
      const dist = (fit * 1.08 * scale) * (1 - 0.12 * push.current);
      const fy = Math.atan2(-fz.position[0], -fz.position[2]) + nudge.current;
      shotLook.set(fz.position[0], f.y - 0.1, fz.position[2]);
      shotPos.set(
        fz.position[0] + Math.sin(fy) * dist,
        f.y + 0.9 + (scale - 1) * 1.6,
        fz.position[2] + Math.cos(fy) * dist,
      );
    }

    /* ---- blend, then ease the camera there ---- */
    desiredBlend(pos, chasePos, shotPos, fz ? sw : 0);
    desiredBlend(look, chaseLook, shotLook, fz ? sw * 0.95 : 0);

    if (!booted.current) {
      camera.position.copy(pos);
      lookNow.copy(look);
      booted.current = true;
    }
    camera.position.lerp(pos, 1 - Math.exp(-dt * (reduced ? 14 : 5.2)));
    lookNow.lerp(look, 1 - Math.exp(-dt * (reduced ? 14 : 8)));
    camera.lookAt(lookNow);

    // running widens the view slightly: speed you can feel
    const wantFov = reduced ? BASE_FOV : run && !inShot ? RUN_FOV : BASE_FOV;
    fov.current = damp(fov.current, wantFov, 4, dt);
    if (Math.abs(camera.fov - fov.current) > 0.01) {
      camera.fov = fov.current;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

function desiredBlend(out: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, t: number) {
  return out.copy(a).lerp(b, t);
}

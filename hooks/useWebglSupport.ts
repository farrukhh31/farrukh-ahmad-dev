"use client";

import { useSyncExternalStore } from "react";

let cached: boolean | null = null;

function detect(): boolean {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    cached = Boolean(gl);
  } catch {
    cached = false;
  }
  return cached;
}

const subscribe = () => () => {};

/**
 * Detects whether the browser can create a WebGL context. The server render
 * (and hydration) assume `true` so the 3D scene is not fought over; on the rare
 * device without WebGL the value flips to `false` so a 2D fallback can render.
 */
export function useWebglSupport() {
  return useSyncExternalStore(subscribe, detect, () => true);
}

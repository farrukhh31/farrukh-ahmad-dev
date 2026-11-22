"use client";

import { useMediaQuery } from "./useMediaQuery";

/**
 * Mirrors `prefers-reduced-motion`. Used to tone down auto-rotation,
 * floating/bobbing and camera easing without removing the 3D experience.
 */
export function useReducedMotion() {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

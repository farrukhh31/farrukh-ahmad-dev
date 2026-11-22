import * as THREE from "three";

/** HDR-bright colour (>1) so the Bloom pass picks it up. */
export const glowColor = (hex: string, intensity = 2.5) =>
  new THREE.Color(hex).multiplyScalar(intensity);

export const FONT_BOLD = "/fonts/orbitron-700.woff";
export const FONT_MED = "/fonts/orbitron-500.woff";

"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Float, Text } from "@react-three/drei";
import * as THREE from "three";

import { atmosphere, blend, motion, PAL } from "@/lib/game/atmosphere";
import { useGame } from "@/lib/game/store";
import { BRIDGES, BRIDGE_HALF_WIDTH, PLATFORMS, type Platform as PlatformData } from "@/lib/game/layout";
import { ZONES, Zone } from "@/lib/game/zones";
import ZoneBuilding from "./ZoneBuildings";
import PlazaCard from "./PlazaCard";
import { FONT_BOLD, FONT_MED, glowColor } from "./Glow";

/* ------------------------------- ground ------------------------------- */

const groundVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

const groundFragment = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uLine;
  uniform vec2 uCenter;
  uniform float uRadius;
  uniform float uTime;
  uniform float uRipple;
  uniform float uInlay;
  varying vec3 vWorld;

  // Anti-aliased grid: lines fade out once they get thinner than a pixel,
  // which removes the shimmering moire on the far side of the island.
  float grid(vec2 p, float size, float width) {
    vec2 q = p / size;
    vec2 fw = max(fwidth(q), vec2(0.0001));
    vec2 g = abs(fract(q - 0.5) - 0.5) / fw;
    float line = 1.0 - min(min(g.x, g.y) / width, 1.0);
    float detail = 1.0 - smoothstep(0.12, 0.35, max(fw.x, fw.y));
    return line * detail;
  }

  void main() {
    float r = length(vWorld.xz - uCenter); // distance from THIS platform's centre
    float fine = grid(vWorld.xz, 2.0, 1.0);
    float bold = grid(vWorld.xz, 10.0, 1.4);
    float fade = 1.0 - smoothstep(uRadius * 0.6, uRadius, r);
    float rim = smoothstep(uRadius - 1.6, uRadius - 0.1, r);
    vec3 col = uBase;
    col += uLine * (fine * 0.14 + bold * 0.45) * fade;
    col += uLine * rim * 0.5;

    // inlaid ring and a ring of studs, so the platform reads as built rather than flat
    float inlayLine = 1.0 - smoothstep(0.0, 0.07, abs(r - uRadius * 0.64));
    float ang = atan(vWorld.z - uCenter.y, vWorld.x - uCenter.x);
    float studs = (1.0 - smoothstep(0.0, 0.1, abs(r - uRadius * 0.8))) * smoothstep(0.55, 0.9, sin(ang * 24.0));
    col += uLine * (inlayLine * 0.42 + studs * 0.55) * uInlay;

    // energy ripple radiating out from the plaza
    float d = mod(r - uTime * 7.0, 30.0);
    float ripple = exp(-d * 1.1) * (1.0 - smoothstep(4.0, uRadius, r)) * smoothstep(3.0, 6.0, r);
    col += uLine * ripple * 0.35 * uRipple;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function Platform({ p }: { p: PlatformData }) {
  const uniforms = useMemo(
    () => ({
      uBase: { value: new THREE.Color("#050b18") },
      uLine: { value: new THREE.Color("#22d3ee") },
      uCenter: { value: new THREE.Vector2(p.x, p.z) },
      uRadius: { value: p.r },
      uTime: { value: 0 },
      uRipple: { value: 1 },
      uInlay: { value: p.id === "plaza" ? 0 : 1 },
    }),
    [p],
  );
  const tint = useMemo(() => new THREE.Color(p.color), [p.color]);
  const rim = useMemo(() => glowColor(p.color, 2.2), [p.color]);

  const mat = useRef<THREE.ShaderMaterial>(null);
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null);
  const rockMat = useRef<THREE.MeshStandardMaterial>(null);
  const lipMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state) => {
    // stone follows the day / night palette instead of staying navy in daylight
    if (bodyMat.current) blend(bodyMat.current.color, PAL.rock, atmosphere.day);
    if (rockMat.current) blend(rockMat.current.color, PAL.rock, atmosphere.day).multiplyScalar(0.86);
    if (lipMat.current) blend(lipMat.current.color, PAL.lip, atmosphere.day);
    const u = mat.current?.uniforms;
    if (!u) return;
    blend(u.uBase.value, PAL.groundBase, atmosphere.day);
    blend(u.uLine.value, PAL.groundLine, atmosphere.day);
    u.uLine.value.lerp(tint, 0.45); // each platform glows in its own zone colour
    u.uTime.value = state.clock.elapsedTime;
    u.uRipple.value = motion.reduced ? 0 : 1;
  });

  const rockH = p.r * 1.25;
  return (
    <group position={[p.x, 0, p.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[p.r, 72]} />
        <shaderMaterial ref={mat} vertexShader={groundVertex} fragmentShader={groundFragment} uniforms={uniforms} />
      </mesh>
      {/* platform body + the rock it floats on */}
      <mesh position={[0, -1.2, 0]}>
        <cylinderGeometry args={[p.r, p.r - 1, 2.2, 48]} />
        <meshStandardMaterial ref={bodyMat} color="#101a33" metalness={0.1} roughness={0.8} />
      </mesh>
      {/* stone lip around the edge */}
      <mesh position={[0, -0.19, 0]}>
        <cylinderGeometry args={[p.r + 0.24, p.r + 0.24, 0.4, 72, 1, true]} />
        <meshStandardMaterial ref={lipMat} color="#1d2c58" metalness={0.05} roughness={0.7} />
      </mesh>
      <mesh position={[0, -2.3 - rockH / 2, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[p.r - 1, rockH, 8]} />
        <meshStandardMaterial ref={rockMat} color="#131d3a" flatShading roughness={0.95} />
      </mesh>
      {/* glowing rim */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <torusGeometry args={[p.r - 0.1, 0.12, 8, 96]} />
        <meshBasicMaterial color={rim} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------- bridges ------------------------------- */

function Bridges() {
  const items = useMemo(
    () =>
      BRIDGES.map((b) => ({
        key: `${b.a.id}-${b.b.id}`,
        b,
        ca: glowColor(b.a.color, 2),
        cb: glowColor(b.b.color, 2),
      })),
    [],
  );

  return (
    <group>
      {items.map(({ key, b, ca, cb }) => (
        <group key={key} position={[b.cx, 0, b.cz]} rotation={[0, b.rotY, 0]}>
          <mesh position={[0, -0.07, 0]}>
            <boxGeometry args={[BRIDGE_HALF_WIDTH * 2, 0.2, b.length]} />
            <meshStandardMaterial color="#14203f" metalness={0.2} roughness={0.6} />
          </mesh>
          {/* glowing rails, blending from one zone's colour to the other's */}
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh position={[side * (BRIDGE_HALF_WIDTH - 0.1), 0.06, -b.length / 4]}>
                <boxGeometry args={[0.1, 0.1, b.length / 2]} />
                <meshBasicMaterial color={ca} toneMapped={false} />
              </mesh>
              <mesh position={[side * (BRIDGE_HALF_WIDTH - 0.1), 0.06, b.length / 4]}>
                <boxGeometry args={[0.1, 0.1, b.length / 2]} />
                <meshBasicMaterial color={cb} toneMapped={false} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/* ------------------------------- plaza -------------------------------- */

function Plaza() {
  const holo = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (holo.current) holo.current.rotation.y += dt * 0.5;
  });
  const cyan = useMemo(() => glowColor("#22d3ee", 2.2), []);
  const violet = useMemo(() => glowColor("#8b5cf6", 2.2), []);

  return (
    <group>
      {[3.2, 5, 6.6].map((r, i) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <ringGeometry args={[r, r + 0.1, 96]} />
          <meshBasicMaterial color={i % 2 ? violet : cyan} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[1.8, 2.1, 0.6, 32]} />
        <meshStandardMaterial color="#16223d" metalness={0.25} roughness={0.45} />
      </mesh>
      {/* small beacon under the card */}
      <group ref={holo} position={[0, 1.5, 0]}>
        <mesh>
          <icosahedronGeometry args={[0.55, 1]} />
          <meshBasicMaterial color={cyan} wireframe toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.0, 0.035, 8, 64]} />
          <meshBasicMaterial color={violet} toneMapped={false} />
        </mesh>
      </group>

      <PlazaCard />
    </group>
  );
}

/* ------------------------------- zones -------------------------------- */

function ZoneSite({ zone }: { zone: Zone }) {
  const active = useGame((s) => s.activeZone === zone.id);
  const visited = useGame((s) => !!s.visited[zone.id]);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const color = useMemo(() => glowColor(zone.color, 2), [zone.color]);

  const [x, , z] = zone.position;
  // rotate so the building's local +Z faces the plaza
  const faceCenter = Math.atan2(-x, -z);

  useFrame((s) => {
    if (ringMat.current) {
      const pulse = active ? 0.7 + Math.sin(s.clock.elapsedTime * 5) * 0.3 : visited ? 0.45 : 0.25;
      ringMat.current.opacity = pulse;
    }
  });

  const labelY = zone.id === "plaza" ? 8 : zone.id === "comms" ? 11.5 : zone.id === "about" ? 12.5 : 7.5;

  return (
    <group position={[x, 0, z]}>
      {/* trigger ring on the ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
        <ringGeometry args={[zone.triggerRadius - 0.9, zone.triggerRadius - 0.75, 96]} />
        <meshBasicMaterial ref={ringMat} color={color} transparent opacity={0.3} toneMapped={false} depthWrite={false} />
      </mesh>

      <group rotation={[0, faceCenter, 0]}>
        <ZoneBuilding id={zone.id} color={zone.color} />
      </group>


      <Float speed={1.5} floatIntensity={0.4} rotationIntensity={0}>
        <Billboard position={[0, labelY, 0]}>
          <Text
            font={FONT_BOLD}
            fontSize={0.7}
            letterSpacing={0.06}
            color={color}
            anchorX="center"
            anchorY="middle"
            material-toneMapped={false}
          >
            {zone.name.toUpperCase()}
          </Text>
          <Text
            font={FONT_MED}
            fontSize={0.28}
            letterSpacing={0.12}
            position={[0, -0.6, 0]}
            color="#94a3b8"
            anchorX="center"
            anchorY="middle"
          >
            {zone.tagline.toUpperCase()}
          </Text>
        </Billboard>
      </Float>
    </group>
  );
}

/** One light that glides to the active platform instead of a light per platform (much cheaper on phones). */
function ZoneLight() {
  const light = useRef<THREE.PointLight>(null);
  useFrame((_, rawDt) => {
    const l = light.current;
    if (!l) return;
    const k = 1 - Math.exp(-Math.min(rawDt, 0.05) * 6);
    const id = useGame.getState().activeZone;
    const z = id ? ZONES.find((q) => q.id === id) : null;
    l.position.x += ((z ? z.position[0] : 0) - l.position.x) * k;
    l.position.z += ((z ? z.position[2] : 0) - l.position.z) * k;
    l.intensity += ((z ? 110 : 0) - l.intensity) * k;
    if (z) l.color.set(z.color);
  });
  return <pointLight ref={light} intensity={0} distance={20} position={[0, 4, 0]} />;
}

export default function World() {
  return (
    <group>
      {PLATFORMS.map((p) => (
        <Platform key={p.id} p={p} />
      ))}
      <Bridges />
      <ZoneLight />
      <Plaza />
      {ZONES.filter((z) => z.id !== "plaza").map((zone) => (
        <ZoneSite key={zone.id} zone={zone} />
      ))}
    </group>
  );
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { glowColor } from "./Glow";
import { atmosphere, motion } from "@/lib/game/atmosphere";
import { playerState } from "@/lib/game/input";
import { useGame } from "@/lib/game/store";
import { ZONE_BY_ID } from "@/lib/game/zones";
import { Text } from "@react-three/drei";
import { Projects } from "@/components/Projects/Projects-s";
import { experience } from "@/components/Experience/ExperiencedData";
import { certificates } from "@/components/certificates/certificatesData";
import { FONT_BOLD } from "./Glow";

import type { ZoneId } from "@/lib/game/zones";

const BODY = { color: "#16223d", metalness: 0.25, roughness: 0.5 } as const;

const DAY_STONE = new THREE.Color("#cbd9e0");

/** Building material: deep navy at night, soft pale stone in daylight (so it suits the pastel archipelago). */
function Body(props: { color?: string }) {
  const night = props.color ?? BODY.color;
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const last = useRef(-1);
  const cols = useMemo(() => {
    const n = new THREE.Color(night);
    return { night: n, day: n.clone().lerp(DAY_STONE, 0.8) };
  }, [night]);
  useFrame(() => {
    const m = mat.current;
    if (!m) return;
    const d = atmosphere.day;
    if (Math.abs(d - last.current) < 0.002) return;
    last.current = d;
    m.color.copy(cols.night).lerp(cols.day, d);
  });
  return <meshStandardMaterial ref={mat} color={night} metalness={BODY.metalness} roughness={BODY.roughness} />;
}

function Neon({ color, intensity = 2.5 }: { color: string; intensity?: number }) {
  const c = useMemo(() => glowColor(color, intensity), [color, intensity]);
  return <meshBasicMaterial color={c} toneMapped={false} />;
}

/* ---------------- individual blockouts (local +Z faces the plaza) ---------------- */

function OriginTower({ color }: { color: string }) {
  const crystal = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (motion.reduced) return;
    if (crystal.current) crystal.current.rotation.y += dt * 0.8;
  });
  return (
    <group>
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[1.5, 2.2, 8, 8]} />
        <Body />
      </mesh>
      {[1.5, 4, 6.5].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.9 - y * 0.05, 0.07, 8, 48]} />
          <Neon color={color} />
        </mesh>
      ))}
      <mesh ref={crystal} position={[0, 9.6, 0]}>
        <octahedronGeometry args={[1, 0]} />
        <Neon color={color} />
      </mesh>
    </group>
  );
}

function SkillGrove({ color }: { color: string }) {
  const crystal = useRef<THREE.Mesh>(null);
  useFrame((s, dt) => {
    if (motion.reduced) return;
    if (crystal.current) {
      crystal.current.rotation.y += dt * 0.6;
      crystal.current.position.y = 2.3 + Math.sin(s.clock.elapsedTime) * 0.15;
    }
  });
  return (
    <group>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[2.4, 2.6, 0.3, 24]} />
        <Body />
      </mesh>
      <mesh ref={crystal} position={[0, 2.3, 0]}>
        <icosahedronGeometry args={[0.8, 0]} />
        <Neon color={color} />
      </mesh>
    </group>
  );
}

const shortTitle = (t: string) => {
  const head = t.split(" - ")[0];
  return head.length > 24 ? head.slice(0, 22) + "…" : head;
};
const projectColor = (cat: string) =>
  cat === "gamedev" ? "#f472b6" : cat === "webdev" ? "#22d3ee" : cat === "ai" ? "#f87171" : "#a78bfa";

function ArcadeHall({ color }: { color: string }) {
  const n = Projects.length;
  const R = 3.15;
  return (
    <group>
      {Projects.map((p, i) => {
        // spread cabinets over the half-circle that faces the plaza
        const spread = Math.min(Math.PI * 0.85, n * 0.5);
        const th = n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1);
        const c = projectColor(p.category);
        return (
          <group key={p.slug} position={[Math.sin(th) * R, 0, Math.cos(th) * R]} rotation={[0, th, 0]} scale={0.9}>
            <mesh position={[0, 1.5, 0]}>
              <boxGeometry args={[1.45, 3, 1.1]} />
              <Body />
            </mesh>
            <mesh position={[0, 2.15, 0.56]} rotation={[-0.12, 0, 0]}>
              <planeGeometry args={[1.2, 1.0]} />
              <meshBasicMaterial color="#04060d" />
            </mesh>
            <Text
              font={FONT_BOLD}
              fontSize={0.13}
              maxWidth={1.05}
              textAlign="center"
              anchorX="center"
              anchorY="middle"
              position={[0, 2.15, 0.575]}
              rotation={[-0.12, 0, 0]}
              color={glowColor(c, 1.6)}
              material-toneMapped={false}
            >
              {shortTitle(p.title).toUpperCase()}
            </Text>
            <mesh position={[0, 3.12, 0.1]}>
              <boxGeometry args={[1.5, 0.2, 1.0]} />
              <Neon color={c} />
            </mesh>
            <mesh position={[0, 0.95, 0.56]}>
              <boxGeometry args={[0.9, 0.08, 0.05]} />
              <Neon color={color} intensity={1.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function QuestRoad({ color }: { color: string }) {
  // oldest on the left, newest (and tallest) on the right
  const items = [...experience].reverse();
  const gap = 1.45;
  return (
    <group>
      {items.map((e, i) => {
        const x = (i - (items.length - 1) / 2) * gap;
        const h = 2.2 + i * 0.7;
        const c = e.type === "education" ? "#60a5fa" : color;
        return (
          <group key={e.id} position={[x, 0, 0]}>
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[0.8, h, 0.8]} />
              <Body />
            </mesh>
            <mesh position={[0, h + 0.12, 0]}>
              <boxGeometry args={[1.0, 0.2, 1.0]} />
              <Neon color={c} />
            </mesh>
            <Text
              font={FONT_BOLD}
              fontSize={0.2}
              position={[0, h * 0.55, 0.42]}
              anchorX="center"
              anchorY="middle"
              color={glowColor(c, 1.8)}
              material-toneMapped={false}
            >
              {e.year}
            </Text>
            {e.current && (
              <mesh position={[0, h + 0.9, 0]}>
                <octahedronGeometry args={[0.25, 0]} />
                <Neon color="#ffffff" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

function TrophyRoom({ color }: { color: string }) {
  const n = certificates.length;
  const R = 3.1;
  return (
    <group>
      {certificates.map((c, i) => {
        const spread = Math.PI * 0.95;
        const th = n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1);
        const done = c.status === "completed";
        const h = 0.7 + (i % 3) * 0.2;
        return (
          <group key={c.id} position={[Math.sin(th) * R, 0, Math.cos(th) * R]} rotation={[0, th, 0]}>
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[0.62, h, 0.62]} />
              <Body />
            </mesh>
            <mesh position={[0, h + 0.38, 0]} rotation={[0, i, 0]}>
              {i % 3 === 0 && <coneGeometry args={[0.24, 0.55, 6]} />}
              {i % 3 === 1 && <dodecahedronGeometry args={[0.27]} />}
              {i % 3 === 2 && <torusKnotGeometry args={[0.18, 0.06, 48, 8]} />}
              {done ? <Neon color={color} /> : <meshStandardMaterial color="#334155" roughness={0.7} />}
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Plays /videos/promo.mp4 on the 3D cinema screen; pauses when the player is far away. */
function CinemaScreen({ color }: { color: string }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const ready = useRef(false);
  const fallback = useMemo(() => glowColor(color, 1.2), [color]);

  useEffect(() => {
    const el = document.createElement("video");
    el.src = "/videos/promo.mp4";
    el.crossOrigin = "anonymous";
    el.loop = true;
    el.muted = true;
    el.playsInline = true;
    el.preload = "auto";
    video.current = el;

    let texture: THREE.VideoTexture | null = null;
    const onData = () => {
      texture = new THREE.VideoTexture(el);
      texture.colorSpace = THREE.SRGBColorSpace;
      if (mat.current) {
        mat.current.map = texture;
        mat.current.color.set("#ffffff");
        mat.current.needsUpdate = true;
      }
      ready.current = true;
    };
    el.addEventListener("loadeddata", onData);
    el.load();

    return () => {
      el.removeEventListener("loadeddata", onData);
      el.pause();
      el.removeAttribute("src");
      el.load();
      texture?.dispose();
      ready.current = false;
    };
  }, []);

  useFrame(() => {
    const el = video.current;
    if (!el || !ready.current) return;
    const z = ZONE_BY_ID.cinema.position;
    // the panel plays its own copy, so the 3D screen rests while the panel is open
    const near = Math.hypot(playerState.x - z[0], playerState.z - z[2]) < 30 && useGame.getState().openPanel !== "cinema";
    if (near && el.paused) void el.play().catch(() => {});
    else if (!near && !el.paused) el.pause();
  });

  return (
    <mesh position={[0, 4, 0.22]}>
      <planeGeometry args={[7, 3.8]} />
      <meshBasicMaterial ref={mat} color={fallback} toneMapped={false} />
    </mesh>
  );
}

function PromoCinema({ color }: { color: string }) {
  return (
    <group>
      {[-3.4, 3.4].map((x) => (
        <mesh key={x} position={[x, 1.5, -0.2]}>
          <boxGeometry args={[0.4, 3, 0.4]} />
          <Body />
        </mesh>
      ))}
      <mesh position={[0, 4, 0]}>
        <boxGeometry args={[7.6, 4.4, 0.4]} />
        <Body />
      </mesh>
      <CinemaScreen color={color} />
    </group>
  );
}

function OracleTerminal({ color }: { color: string }) {
  const head = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (motion.reduced) return;
    if (head.current) {
      head.current.position.y = 3 + Math.sin(s.clock.elapsedTime * 1.6) * 0.2;
      head.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.6) * 0.5;
    }
  });
  return (
    <group>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[1.8, 2, 0.8, 20]} />
        <Body />
      </mesh>
      <group ref={head} position={[0, 3, 0]}>
        <mesh>
          <sphereGeometry args={[1, 24, 24]} />
          <Body color="#1d2a4a" />
        </mesh>
        <mesh position={[0, 0.05, 0.85]}>
          <boxGeometry args={[1.1, 0.35, 0.3]} />
          <Neon color={color} />
        </mesh>
      </group>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 1.4, 8]} />
        <Neon color={color} intensity={1.6} />
      </mesh>
    </group>
  );
}

function CommsTower({ color }: { color: string }) {
  const dish = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (motion.reduced) return;
    if (dish.current) dish.current.rotation.z += dt * 1.2;
  });
  return (
    <group>
      <mesh position={[0, 4.5, 0]}>
        <cylinderGeometry args={[0.35, 0.8, 9, 8]} />
        <Body />
      </mesh>
      <mesh ref={dish} position={[0, 8.6, 0]}>
        <torusGeometry args={[1.1, 0.06, 8, 40]} />
        <Neon color={color} />
      </mesh>
      <mesh position={[0, 9.4, 0]}>
        <sphereGeometry args={[0.25, 12, 12]} />
        <Neon color={color} />
      </mesh>
      {/* mailbox */}
      <mesh position={[0, 0.9, 1.8]}>
        <boxGeometry args={[1.2, 1.8, 0.9]} />
        <Body />
      </mesh>
      <mesh position={[0, 1.3, 2.26]}>
        <boxGeometry args={[0.8, 0.12, 0.05]} />
        <Neon color={color} />
      </mesh>
    </group>
  );
}

function ResumeHangar({ color }: { color: string }) {
  const sheet = useRef<THREE.Group>(null);
  useFrame((st) => {
    if (motion.reduced || !sheet.current) return;
    sheet.current.position.y = 3.2 + Math.sin(st.clock.elapsedTime * 1.4) * 0.18;
    sheet.current.rotation.y = Math.sin(st.clock.elapsedTime * 0.5) * 0.25;
  });
  return (
    <group>
      {/* hangar: two walls and a roof arch */}
      {[-2.2, 2.2].map((x) => (
        <mesh key={x} position={[x, 1.6, 0]}>
          <boxGeometry args={[0.5, 3.2, 3.6]} />
          <Body />
        </mesh>
      ))}
      <mesh position={[0, 3.4, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.55, 5, 16, 1, false, 0, Math.PI]} />
        <Body />
      </mesh>
      <mesh position={[0, 0.06, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 1.65, 48]} />
        <Neon color={color} />
      </mesh>
      {/* floating resume sheet */}
      <group ref={sheet} position={[0, 3.2, 0.4]}>
        <mesh>
          <boxGeometry args={[1.5, 2, 0.08]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.6} />
        </mesh>
        {[0.55, 0.2, -0.15, -0.5].map((y, i) => (
          <mesh key={y} position={[i === 0 ? -0.15 : 0, y, 0.05]}>
            <boxGeometry args={[i === 0 ? 0.9 : 1.1, 0.09, 0.02]} />
            <Neon color={color} intensity={1.4} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function HireHarbour({ color }: { color: string }) {
  const flag = useRef<THREE.Mesh>(null);
  useFrame((st) => {
    if (motion.reduced || !flag.current) return;
    flag.current.rotation.y = Math.sin(st.clock.elapsedTime * 2) * 0.25;
  });
  return (
    <group>
      {/* dock */}
      <mesh position={[0, 0.2, 0.5]}>
        <boxGeometry args={[4.4, 0.4, 2.2]} />
        <Body />
      </mesh>
      {/* mast with a pennant */}
      <mesh position={[0, 3.2, -0.2]}>
        <cylinderGeometry args={[0.1, 0.14, 6, 8]} />
        <Body />
      </mesh>
      <mesh ref={flag} position={[0.7, 5.4, -0.2]}>
        <boxGeometry args={[1.3, 0.7, 0.05]} />
        <Neon color={color} />
      </mesh>
      {/* signboard */}
      <mesh position={[0, 1.3, 1.5]}>
        <boxGeometry args={[2.6, 1.3, 0.2]} />
        <Body color="#1d2a4a" />
      </mesh>
      <mesh position={[0, 1.3, 1.62]}>
        <boxGeometry args={[2.1, 0.22, 0.04]} />
        <Neon color={color} intensity={1.8} />
      </mesh>
      {/* lanterns */}
      {[-1.9, 1.9].map((x) => (
        <mesh key={x} position={[x, 1.1, 1.4]}>
          <sphereGeometry args={[0.22, 12, 12]} />
          <Neon color={color} />
        </mesh>
      ))}
    </group>
  );
}

export default function ZoneBuilding({ id, color }: { id: ZoneId; color: string }) {
  switch (id) {
    case "about":
      return <OriginTower color={color} />;
    case "skills":
      return <SkillGrove color={color} />;
    case "projects":
      return <ArcadeHall color={color} />;
    case "quest":
      return <QuestRoad color={color} />;
    case "trophy":
      return <TrophyRoom color={color} />;
    case "cinema":
      return <PromoCinema color={color} />;
    case "oracle":
      return <OracleTerminal color={color} />;
    case "resume":
      return <ResumeHangar color={color} />;
    case "hire":
      return <HireHarbour color={color} />;
    case "comms":
      return <CommsTower color={color} />;
    default:
      return null;
  }
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Float, RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";

import { socialLinks } from "@/components/SocialSidebar/Sociallinks";
import { ROLES } from "@/components/hero/hero.data";
import { sfx } from "@/lib/game/audio";
import { levelFromXp, useGame } from "@/lib/game/store";
import { FONT_BOLD, FONT_MED, glowColor } from "./Glow";
import { RESUME_FILE, RESUME_URL } from "./PlayerCard";

const BRAND: Record<string, string> = { GitHub: "#e2e8f0", LinkedIn: "#38bdf8", Instagram: "#f472b6", Email: "#fbbf24" };

function Btn({
  x, y, w, h, label, color, filled = false, size = 0.17, onClick,
}: {
  x: number; y: number; w: number; h: number; label: string; color: string; filled?: boolean; size?: number; onClick: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const fill = useMemo(() => glowColor(color, hover ? 2.6 : 1.7), [color, hover]);
  const edge = useMemo(() => glowColor(color, hover ? 2.2 : 1.1), [color, hover]);

  useFrame((_, dt) => {
    if (!group.current) return;
    const t = hover ? 1.05 : 1;
    group.current.scale.lerp(new THREE.Vector3(t, t, 1), 1 - Math.exp(-dt * 14));
  });
  useEffect(() => () => { document.body.style.cursor = ""; }, []);

  return (
    <group
      ref={group}
      position={[x, y, 0.09]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = "pointer";
        sfx.hover();
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "";
      }}
      onClick={(e) => {
        e.stopPropagation();
        sfx.click();
        onClick();
      }}
    >
      <RoundedBox args={[w + 0.05, h + 0.05, 0.03]} position={[0, 0, -0.02]} radius={0.12} smoothness={4}>
        <meshBasicMaterial color={edge} toneMapped={false} />
      </RoundedBox>
      <RoundedBox args={[w, h, 0.05]} radius={0.1} smoothness={4}>
        <meshBasicMaterial color={filled ? fill : "#0b1430"} toneMapped={false} />
      </RoundedBox>
      <Text font={FONT_BOLD} fontSize={size} letterSpacing={0.08} position={[0, 0, 0.04]} color={filled ? "#031018" : "#e2e8f0"} anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  );
}

function open(href: string) {
  window.open(href, "_blank", "noopener,noreferrer");
}

/**
 * A floating holographic player card in the middle of the Spawn Plaza.
 * Everything is clickable in 3D: download the resume or open any profile.
 */
export default function PlazaCard() {
  const xp = useGame((s) => s.xp);
  const level = levelFromXp(xp);
  const cyan = useMemo(() => glowColor("#22d3ee", 2.2), []);
  const violet = useMemo(() => glowColor("#8b5cf6", 2.2), []);

  const download = () => {
    const a = document.createElement("a");
    a.href = RESUME_URL;
    a.download = RESUME_FILE;
    document.body.appendChild(a);
    a.click();
    a.remove();
    sfx.success();
  };

  const grid: [number, number][] = [[-1.2, -1.2], [1.2, -1.2], [-1.2, -1.85], [1.2, -1.85]];

  return (
    <Float speed={1.4} floatIntensity={0.35} rotationIntensity={0}>
      <Billboard position={[0, 5.1, 0]}>
        {/* glowing frame + glass body */}
        <RoundedBox args={[5.56, 4.86, 0.04]} position={[0, 0, -0.08]} radius={0.24} smoothness={4}>
          <meshBasicMaterial color={cyan} toneMapped={false} />
        </RoundedBox>
        <RoundedBox args={[5.4, 4.7, 0.1]} radius={0.2} smoothness={4}>
          <meshStandardMaterial color="#070d1f" metalness={0.3} roughness={0.5} transparent opacity={0.94} />
        </RoundedBox>
        <mesh position={[1.7, 1.9, 0.06]}>
          <circleGeometry args={[0.9, 32]} />
          <meshBasicMaterial color={violet} transparent opacity={0.16} toneMapped={false} />
        </mesh>

        {/* header: avatar + name */}
        <group position={[-1.95, 1.62, 0.07]}>
          <mesh>
            <ringGeometry args={[0.46, 0.53, 48]} />
            <meshBasicMaterial color={cyan} toneMapped={false} />
          </mesh>
          <mesh>
            <circleGeometry args={[0.45, 40]} />
            <meshBasicMaterial color="#0a1124" />
          </mesh>
          <Text font={FONT_BOLD} fontSize={0.27} position={[0, 0, 0.01]} color="#ffffff" anchorX="center" anchorY="middle">FA</Text>
        </group>
        <Text font={FONT_BOLD} fontSize={0.34} letterSpacing={0.05} position={[-1.3, 1.85, 0.07]} color="#ffffff" anchorX="left" anchorY="middle">
          FARRUKH AHMAD
        </Text>
        <Text font={FONT_MED} fontSize={0.125} letterSpacing={0.1} position={[-1.3, 1.45, 0.07]} color="#94a3b8" anchorX="left" anchorY="middle">
          {ROLES.slice(0, 3).join("  ·  ").toUpperCase()}
        </Text>
        <Text font={FONT_BOLD} fontSize={0.15} letterSpacing={0.12} position={[-1.3, 1.12, 0.07]} color={cyan} anchorX="left" anchorY="middle" material-toneMapped={false}>
          {`LV ${level}  ·  ${xp} XP`}
        </Text>

        <mesh position={[0, 0.78, 0.06]}>
          <planeGeometry args={[4.8, 0.012]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.35} />
        </mesh>

        <Btn x={0} y={0.28} w={4.8} h={0.72} label="DOWNLOAD RESUME" color="#22d3ee" filled size={0.21} onClick={download} />
        <Btn x={0} y={-0.5} w={4.8} h={0.5} label="VIEW RESUME ONLINE" color="#8b5cf6" size={0.15} onClick={() => open(RESUME_URL)} />

        {socialLinks.slice(0, 4).map((l, i) => (
          <Btn key={l.name} x={grid[i][0]} y={grid[i][1]} w={2.3} h={0.5} label={l.name.toUpperCase()} color={BRAND[l.name] ?? "#22d3ee"} size={0.15} onClick={() => open(l.href)} />
        ))}
      </Billboard>
    </Float>
  );
}

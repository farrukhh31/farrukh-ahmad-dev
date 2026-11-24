"use client";

import { useEffect, useRef } from "react";
import { playerState } from "@/lib/game/input";
import { useGame } from "@/lib/game/store";
import { BRIDGES, PLATFORMS } from "@/lib/game/layout";
import { ISLAND_RADIUS, ZONES } from "@/lib/game/zones";

export default function Minimap({ size = 156 }: { size?: number }) {
  const SIZE = size;
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const scale = (SIZE / 2 - 6) / ISLAND_RADIUS;
    let raf = 0;

    const draw = () => {
      const { visited, activeZone } = useGame.getState();
      const light = document.documentElement.classList.contains("light");
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.save();
      ctx.translate(SIZE / 2, SIZE / 2);

      // bridges first, then the platforms on top of them
      ctx.lineCap = "round";
      ctx.strokeStyle = light ? "rgba(51,65,85,0.4)" : "rgba(148,163,184,0.45)";
      ctx.lineWidth = 3;
      for (const b of BRIDGES) {
        ctx.beginPath();
        ctx.moveTo(b.sx * scale, b.sz * scale);
        ctx.lineTo(b.ex * scale, b.ez * scale);
        ctx.stroke();
      }
      for (const p of PLATFORMS) {
        ctx.beginPath();
        ctx.arc(p.x * scale, p.z * scale, p.r * scale, 0, Math.PI * 2);
        ctx.fillStyle = light ? "rgba(255,255,255,0.85)" : "rgba(5,11,24,0.8)";
        ctx.fill();
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      for (const z of ZONES) {
        const x = z.position[0] * scale;
        const y = z.position[2] * scale;
        ctx.beginPath();
        ctx.arc(x, y, activeZone === z.id ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = visited[z.id] ? z.color : light ? "rgba(100,116,139,0.35)" : "rgba(148,163,184,0.35)";
        ctx.fill();
        ctx.strokeStyle = z.color;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.translate(playerState.x * scale, playerState.z * scale);
      ctx.rotate(-playerState.heading);
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(4.5, -4);
      ctx.lineTo(-4.5, -4);
      ctx.closePath();
      ctx.fillStyle = light ? "#0f172a" : "#fff";
      ctx.fill();

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [SIZE]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="block rounded-[18px]"
      style={{ width: SIZE, height: SIZE }}
    />
  );
}

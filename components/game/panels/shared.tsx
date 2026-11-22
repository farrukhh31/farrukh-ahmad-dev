"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

/** Small pill. Coloured when `color` is passed, clickable when `onClick` is passed. */
export function Chip({ children, color, active, onClick }: { children: React.ReactNode; color?: string; active?: boolean; onClick?: () => void }) {
  const base = "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide transition";
  const style = color
    ? { borderColor: active ? `${color}aa` : `${color}44`, background: active ? `${color}33` : `${color}12`, color, boxShadow: active ? `0 0 18px ${color}33` : undefined }
    : undefined;
  const plain = color ? "" : active ? "border-white/40 bg-white/15 text-white" : "border-white/10 bg-white/5 text-slate-300";
  if (onClick) {
    return (
      <button onClick={onClick} aria-pressed={active} className={`${base} ${plain} hover:brightness-125 focus-visible:outline-2 focus-visible:outline-cyan-300`} style={style}>
        {children}
      </button>
    );
  }
  return (
    <span className={`${base} ${plain}`} style={style}>
      {children}
    </span>
  );
}

export function SectionTitle({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <h3 className="mb-3 mt-8 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400 first:mt-0">
      <span className="h-px w-6" style={{ background: accent ?? "rgba(148,163,184,0.5)" }} />
      {children}
      <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
    </h3>
  );
}

/**
 * Glass card with a hairline accent border and a spotlight that follows the cursor.
 * With `tilt` it also leans towards the pointer in 3D and catches a moving glare.
 */
export function Card({
  children,
  accent = "#22d3ee",
  index = 0,
  lift = true,
  tilt = false,
  as = "div",
  className = "",
  style,
}: {
  children: React.ReactNode;
  accent?: string;
  index?: number;
  lift?: boolean;
  tilt?: boolean;
  as?: "div" | "li" | "article" | "section";
  className?: string;
  style?: React.CSSProperties;
}) {
  const Tag = as as React.ElementType<React.HTMLAttributes<HTMLElement>>;
  return (
    <Tag
      onMouseMove={(e: React.MouseEvent<HTMLElement>) => {
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        el.style.setProperty("--mx", `${x}px`);
        el.style.setProperty("--my", `${y}px`);
        if (tilt) {
          el.style.setProperty("--ry", `${(x / r.width - 0.5) * 9}deg`);
          el.style.setProperty("--rx", `${-(y / r.height - 0.5) * 9}deg`);
        }
      }}
      onMouseLeave={
        tilt
          ? (e: React.MouseEvent<HTMLElement>) => {
              e.currentTarget.style.setProperty("--rx", "0deg");
              e.currentTarget.style.setProperty("--ry", "0deg");
            }
          : undefined
      }
      className={`panel-card panel-rise ${lift ? "lift" : ""} ${tilt ? "tilt" : ""} ${className}`}
      style={{ "--accent": accent, "--i": index, ...style } as CSSVars}
    >
      {tilt && <span aria-hidden className="glare" />}
      {children}
    </Tag>
  );
}

/** Numbers that count up when they scroll into view. */
export function Count({ to, suffix = "", duration = 1100 }: { to: number; suffix?: string; duration?: number }) {
  const { ref, inView } = useInView({ triggerOnce: true });
  const [n, setN] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!inView) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [inView, to, duration]);
  return <span ref={ref}>{n}{suffix}</span>;
}

export function ProgressBar({ value, color = "#22d3ee", label, height = 6, index = 0 }: { value: number; color?: string; label: string; height?: number; index?: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="overflow-hidden rounded-full bg-white/10" style={{ height }} role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="bar-fill bar-shine h-full rounded-full"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}99, ${color})`, boxShadow: `0 0 12px ${color}66`, "--i": index } as CSSVars}
      />
    </div>
  );
}

/** Circular gauge. Draws itself in with a CSS animation (no JS state). */
export function Ring({ value, color = "#22d3ee", size = 64, stroke = 5, label, children }: { value: number; color?: string; size?: number; stroke?: number; label: string; children?: React.ReactNode }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(pct)}%`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={stroke} />
        <circle
          className="ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{ "--c": c, "--to": c * (1 - pct / 100), filter: `drop-shadow(0 0 6px ${color}99)` } as CSSVars}
        />
      </svg>
      <span className="absolute font-mono text-[11px] font-semibold tabular-nums text-white">{children ?? Math.round(pct)}</span>
    </div>
  );
}

/** Big number + caption, used for headline stats. */
export function Stat({ value, label, color = "#22d3ee" }: { value: React.ReactNode; label: string; color?: string }) {
  return (
    <div>
      <p className="font-mono text-3xl font-semibold leading-none tracking-tight tabular-nums text-white" style={{ textShadow: `0 0 28px ${color}55` }}>
        {value}
      </p>
      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
    </div>
  );
}

/** Small label that sits above a panel heading. */
export function Eyebrow({ children, color = "#22d3ee" }: { children: React.ReactNode; color?: string }) {
  return (
    <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.32em]" style={{ color }}>
      <span className="relative grid h-1.5 w-1.5 place-items-center rounded-full" style={{ background: color }}>
        <span className="live-ping absolute inset-0 rounded-full" style={{ background: color }} />
      </span>
      {children}
    </p>
  );
}

/** <img> that degrades to a gradient tile when the file is missing. */
export function SafeImg({ src, alt, color = "#22d3ee", className = "" }: { src?: string; alt: string; color?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`relative grid place-items-center overflow-hidden ${className}`}
        style={{ background: `radial-gradient(circle at 25% 20%, ${color}55, transparent 60%), linear-gradient(135deg, ${color}22, #070b18)` }}
      >
        <span className="font-mono text-4xl font-bold tracking-tighter" style={{ color, textShadow: `0 0 30px ${color}88` }}>
          {alt.slice(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
}

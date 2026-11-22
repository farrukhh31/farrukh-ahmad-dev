"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Code2, ExternalLink, Play, Search } from "lucide-react";
import { Projects, type Project } from "@/components/Projects/Projects-s";
import { Card, Chip, Eyebrow, SafeImg } from "./shared";

type Filter = "all" | Project["category"];
type Sort = "featured" | "az" | "custom";

const CATEGORY = {
  gamedev: { label: "Game Dev", color: "#f472b6" },
  webdev: { label: "Full-Stack", color: "#22d3ee" },
  ai: { label: "AI", color: "#f87171" },
  devops: { label: "DevOps", color: "#a78bfa" },
} as const;

function VideoBox({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <p className="mt-3 rounded-xl border border-dashed border-white/10 p-3 text-xs text-slate-500">Video file not found at {src}. Add it to /public/videos to enable playback.</p>;
  }
  return <video src={src} controls preload="metadata" onError={() => setFailed(true)} className="mt-3 aspect-video w-full rounded-xl bg-black" />;
}

export default function ProjectsPanel() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("featured");
  const [order, setOrder] = useState<string[]>(() => Projects.map((p) => p.slug));
  const [playing, setPlaying] = useState<string | null>(null);

  const categories = useMemo(() => Array.from(new Set(Projects.map((p) => p.category))), []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = Projects.filter(
      (p) =>
        (filter === "all" || p.category === filter) &&
        (!q || [p.title, p.description, ...p.technologies].join(" ").toLowerCase().includes(q)),
    );
    if (sort === "az") out = [...out].sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "featured") out = [...out].sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    else out = [...out].sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
    return out;
  }, [query, filter, sort, order]);

  const move = (slug: string, dir: -1 | 1) =>
    setOrder((o) => {
      const i = o.indexOf(slug);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <div>
      <Eyebrow color="#f472b6">Insert coin</Eyebrow>
      <h3 className="mt-2 text-xl font-semibold text-white">{Projects.length} cabinets on the floor</h3>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[180px] flex-1">
          <span className="sr-only">Search projects</span>
          <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects or tech…"
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 transition focus:border-pink-400/60 focus:bg-white/[0.07] focus:outline-none focus:ring-4 focus:ring-pink-400/10"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Order
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-xl border border-white/10 bg-slate-900 px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-pink-400/30">
            <option value="featured">Featured first</option>
            <option value="az">A → Z</option>
            <option value="custom">My custom order</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>All ({Projects.length})</Chip>
        {categories.map((c) => (
          <Chip key={c} color={CATEGORY[c].color} active={filter === c} onClick={() => setFilter(c)}>
            {CATEGORY[c].label} ({Projects.filter((p) => p.category === c).length})
          </Chip>
        ))}
      </div>
      {sort === "custom" && <p className="mt-2 text-xs text-slate-500">Use the arrows on each card to reorder your list.</p>}

      {list.length === 0 && <p className="mt-8 text-center text-sm text-slate-500">No projects match that search.</p>}

      <ul className="mt-5 grid gap-4 md:grid-cols-2">
        {list.map((p, i) => {
          const cat = CATEGORY[p.category];
          const hero = i === 0 && sort === "featured" && !!p.featured && list.length > 1;
          return (
            <Card as="li" tilt key={p.slug} accent={cat.color} index={Math.min(i, 8)} className={`flex flex-col ${hero ? "md:col-span-2" : ""}`}>
              <div className={`relative overflow-hidden ${hero ? "md:flex" : ""}`}>
                <div className={`relative overflow-hidden ${hero ? "md:w-[46%] md:shrink-0" : ""}`}>
                  <SafeImg src={p.image} alt={p.title} color={cat.color} className={`w-full ${hero ? "h-48 md:h-full md:min-h-[260px]" : "h-40"}`} />
                  <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#060a16]/80 via-transparent to-transparent" />
                  <div className="absolute left-3 top-3 flex items-center gap-2">
                    <Chip color={cat.color}>{cat.label}</Chip>
                    {p.featured && <span className="rounded-full bg-amber-300/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-950">Featured</span>}
                  </div>
                </div>

                <div className="min-w-0 flex-1 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`font-semibold tracking-tight text-white ${hero ? "text-xl" : "text-base"}`}>{p.title}</h3>
                    {sort === "custom" && (
                      <div className="flex shrink-0 gap-1">
                        <button onClick={() => move(p.slug, -1)} aria-label={`Move ${p.title} up`} className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-slate-300 hover:bg-white/10"><ArrowUp size={13} /></button>
                        <button onClick={() => move(p.slug, 1)} aria-label={`Move ${p.title} down`} className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-slate-300 hover:bg-white/10"><ArrowDown size={13} /></button>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-slate-300">{p.description}</p>
                  {p.highlight && <p className="mt-2 border-l-2 pl-3 text-xs italic leading-relaxed text-slate-400" style={{ borderColor: `${cat.color}88` }}>{p.highlight}</p>}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.technologies.map((t) => <Chip key={t}>{t}</Chip>)}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {p.video && (
                      <button onClick={() => setPlaying(playing === p.slug ? null : p.slug)} className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold text-white transition hover:brightness-125" style={{ background: `linear-gradient(135deg, ${cat.color}66, ${cat.color}33)`, boxShadow: `0 0 20px ${cat.color}33` }}>
                        <Play size={12} /> {playing === p.slug ? "Hide video" : (p.videoLabel ?? "Watch video")}
                      </button>
                    )}
                    {p.github && <a href={p.github} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-slate-200 transition hover:bg-white/10"><Code2 size={12} /> Source</a>}
                    {p.demo && <a href={p.demo} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-slate-200 transition hover:bg-white/10"><ExternalLink size={12} /> Live demo</a>}
                  </div>
                  {p.video && playing === p.slug && <VideoBox src={p.video} />}
                </div>
              </div>
            </Card>
          );
        })}
      </ul>
    </div>
  );
}

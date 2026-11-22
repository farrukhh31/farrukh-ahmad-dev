"use client";

import { useState } from "react";

interface Summary {
  since: string;
  today: { pageviews: number; visitors: number };
  totals: { pageviews: number; events: number };
  daily: { day: string; pageviews: number; visitors: number }[];
  breakdown: Record<string, { name: string; count: number }[]>;
}

const TITLES: Record<string, string> = {
  pageview: "Pages viewed",
  zone: "Zones discovered",
  panel: "Panels opened",
  skill: "Skill orbs collected",
  achievement: "Achievements unlocked",
  oracle: "Chatbot questions (by language)",
  contact: "Contact messages sent",
  emote: "Avatar gestures",
  setting: "Settings changed",
};

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 text-xs text-slate-300">
          <span className="truncate" title={r.label}>{r.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-slate-400">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

export default function StatsDashboard() {
  const [key, setKey] = useState("");
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/analytics", { headers: { authorization: `Bearer ${key}` }, cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Could not load the numbers.");
      setData(body as Summary);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Could not load the numbers.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-6 text-slate-200">
      <h1 className="text-2xl font-bold text-white">Site analytics</h1>
      <p className="mt-1 text-sm text-slate-400">
        Anonymous counters only: no cookies, no IP addresses stored, nothing that identifies a visitor.
      </p>

      <form onSubmit={load} className="mt-5 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-400">Dashboard key</span>
          <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} className="w-72 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none" />
        </label>
        <button disabled={!key || loading} className="rounded-xl bg-cyan-400/20 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-400/30 disabled:opacity-40">
          {loading ? "Loading…" : "Show numbers"}
        </button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}

      {data && (
        <div className="mt-8 space-y-8">
          <section aria-label="Totals" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Visitors today", data.today.visitors],
              ["Page views today", data.today.pageviews],
              ["Page views (30 days)", data.totals.pageviews],
              ["All events (30 days)", data.totals.events],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-2xl font-bold tabular-nums text-white">{value}</p>
                <p className="text-xs text-slate-400">{label}</p>
              </div>
            ))}
          </section>

          <section aria-label="Last 14 days">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-slate-400">Last 14 days</h2>
            <Bars rows={data.daily.map((d) => ({ label: `${d.day.slice(5)} · ${d.visitors} visitors`, value: d.pageviews }))} />
          </section>

          <div className="grid gap-8 sm:grid-cols-2">
            {Object.entries(data.breakdown).map(([type, rows]) => (
              <section key={type} aria-label={TITLES[type] ?? type}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-slate-400">{TITLES[type] ?? type}</h2>
                <Bars rows={rows.slice(0, 8).map((r) => ({ label: r.name, value: r.count }))} />
              </section>
            ))}
          </div>
          <p className="text-xs text-slate-500">Counting since {new Date(data.since).toLocaleString()}. Numbers are kept for 30 days.</p>
        </div>
      )}
    </main>
  );
}

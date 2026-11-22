"use client";

import { useState } from "react";
import { Film } from "lucide-react";
import { Card, Eyebrow } from "./shared";

/** Promo video slot. */
export const PROMO_SRC = "/videos/promo.mp4";
const BLUE = "#60a5fa";

export default function CinemaPanel() {
  const [failed, setFailed] = useState(false);
  return (
    <div>
      <Eyebrow color={BLUE}>Now showing</Eyebrow>
      <h3 className="mt-2 text-xl font-semibold text-white">The 46-second introduction</h3>
      <p className="mt-1 text-sm text-slate-400">An animated promo made in After Effects.</p>

      <Card accent={BLUE} lift={false} className="mt-5 p-2 sm:p-2.5">
        <div className="mb-2 flex items-center gap-1.5 px-2 pt-1">
          <span className="h-2 w-2 rounded-full bg-rose-400/80" />
          <span className="h-2 w-2 rounded-full bg-amber-300/80" />
          <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
          <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">promo.mp4</span>
        </div>
        {failed ? (
          <div className="grid aspect-video place-items-center rounded-xl border border-dashed border-blue-400/30 bg-blue-400/[0.04] p-6 text-center">
            <div>
              <Film className="mx-auto text-blue-300" size={28} />
              <p className="mt-3 text-sm font-medium text-white">Promo video not found</p>
              <p className="mt-1 text-xs text-slate-400">Expected at {PROMO_SRC}.</p>
            </div>
          </div>
        ) : (
          <video src={PROMO_SRC} poster="/videos/promo-poster.jpg" controls preload="metadata" onError={() => setFailed(true)} className="aspect-video w-full rounded-xl bg-black" />
        )}
      </Card>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";

/** Avatar badge: spinning cyan/violet ring around the FA monogram (matches the in-game player card). */
export default function Logo() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7 }}
      className="relative mx-auto grid h-24 w-24 place-items-center"
    >
      <span aria-hidden className="aura-spin absolute inset-0 rounded-full" />
      <span className="relative grid h-[88px] w-[88px] place-items-center rounded-full bg-[#0a1124] font-mono text-3xl font-bold tracking-tight text-white">
        FA
      </span>
      <span className="absolute -bottom-1 -right-1 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-2.5 py-0.5 font-mono text-[10px] font-bold text-slate-950">
        LV 1
      </span>
    </motion.div>
  );
}
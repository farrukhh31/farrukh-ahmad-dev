"use client";

import ModeLink from "@/components/PlayCTA/ModeLink";
import { motion } from "framer-motion";
import { Gamepad2 } from "lucide-react";

/**
 * Floating "Play" shortcut for Recruiter Mode on phones/tablets, where the
 * navbar collapses into a menu. Desktop gets PlayLink in the navbar instead.
 */
export default function PlayPill() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1.1rem,env(safe-area-inset-bottom))] z-40 flex justify-center lg:hidden">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4, duration: 0.6, ease: "easeOut" }}
        className="pointer-events-auto"
      >
        <ModeLink
          href="/play"
          className="flex items-center gap-2.5 rounded-full border border-cyan-300/30 bg-[#06101f]/85 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_40px_rgba(34,211,238,.28)] backdrop-blur-xl transition active:scale-95"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-linear-to-br from-cyan-400 to-violet-500 text-white">
            <Gamepad2 size={15} />
          </span>
          Play the game
        </ModeLink>
      </motion.div>
    </div>
  );
}

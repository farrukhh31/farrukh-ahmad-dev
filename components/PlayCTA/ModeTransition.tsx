"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Fades the page back in once a mode switch has finished navigating. Renders nothing. */
export default function ModeTransition() {
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.classList.remove("mode-leaving");
  }, [pathname]);
  return null;
}

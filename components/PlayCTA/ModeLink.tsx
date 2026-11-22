"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Drop-in replacement for <Link> used when switching between Tour, Explore and Recruiter mode.
 * The page fades out first (see `mode-leaving` in globals.css), so the switch feels like one
 * product rather than three separate pages. Modified clicks and reduced-motion users navigate normally.
 */
export default function ModeLink({ href, onClick, ...rest }: React.ComponentProps<typeof Link>) {
  const router = useRouter();
  return (
    <Link
      href={href}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (typeof href !== "string") return;
        const root = document.documentElement;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.classList.contains("a11y-reduce-motion")) return;
        e.preventDefault();
        root.classList.add("mode-leaving");
        window.setTimeout(() => router.push(href), 260);
      }}
    />
  );
}

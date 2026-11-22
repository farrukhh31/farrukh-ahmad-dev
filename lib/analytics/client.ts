"use client";

import type { AnalyticsEvent, EventType } from "./events";

/**
 * Browser side of the analytics. Sends tiny, anonymous events to /api/analytics.
 * Off automatically when the browser says Do Not Track / Global Privacy Control, and the
 * visitor can switch it off from Settings (stored locally, never sent anywhere).
 */
const OPT_OUT_KEY = "farrukh-analytics-optout";

export function analyticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (navigator.doNotTrack === "1" || nav.globalPrivacyControl) return false;
  try {
    return localStorage.getItem(OPT_OUT_KEY) !== "1";
  } catch {
    return true;
  }
}

export function setAnalyticsOptOut(optOut: boolean) {
  try {
    if (optOut) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    /* private mode: nothing to remember */
  }
}

let queue: AnalyticsEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const seenPages = new Set<string>();

function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (queue.length === 0) return;
  const batch = queue.slice(0, 10);
  queue = queue.slice(10);
  const body = JSON.stringify({ events: batch });
  try {
    if (!(navigator.sendBeacon && navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" })))) {
      void fetch("/api/analytics", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    /* analytics must never break the site */
  }
  if (queue.length) flush();
}

export function track(type: EventType, name = "-") {
  if (!analyticsEnabled()) return;
  if (type === "pageview") {
    if (seenPages.has(name)) return; // once per page per tab session
    seenPages.add(name);
  }
  queue.push({ type, name });
  if (!timer) timer = setTimeout(flush, 800);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
}

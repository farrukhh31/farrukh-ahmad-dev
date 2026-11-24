import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false while rendering on the server and during hydration, true afterwards.
 * Use it for anything that depends on the browser (saved theme, window size) so the first
 * client render matches the server HTML and React does not report a hydration mismatch.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
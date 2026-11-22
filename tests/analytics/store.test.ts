import { beforeEach, describe, expect, it } from "vitest";
import { __resetAnalytics, record, summary, visitorHash } from "@/lib/analytics/store";

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 10, 20, 12);
beforeEach(() => __resetAnalytics());

describe("analytics store", () => {
  it("counts events and page views", () => {
    record([{ type: "pageview", name: "/play" }, { type: "zone", name: "about" }], "v1", t0);
    record([{ type: "zone", name: "about" }], "v2", t0);
    const s = summary(t0);
    expect(s.today).toEqual({ pageviews: 1, visitors: 2 });
    expect(s.breakdown.zone).toEqual([{ name: "about", count: 2 }]);
    expect(s.totals).toEqual({ pageviews: 1, events: 3 });
  });

  it("counts a returning visitor once per day", () => {
    record([{ type: "pageview", name: "/" }], "same", t0);
    record([{ type: "pageview", name: "/play" }], "same", t0 + 1000);
    expect(summary(t0 + 2000).today.visitors).toBe(1);
  });

  it("orders the breakdown by count", () => {
    record([{ type: "skill", name: "react" }], "v", t0);
    record([{ type: "skill", name: "three" }, { type: "skill", name: "three" }], "v", t0);
    expect(summary(t0).breakdown.skill[0]).toEqual({ name: "three", count: 2 });
  });

  it("forgets data older than 30 days", () => {
    record([{ type: "pageview", name: "/" }], "old", t0);
    expect(summary(t0 + 31 * DAY).totals.pageviews).toBe(0);
  });

  it("reports 14 daily rows, oldest first", () => {
    const rows = summary(t0).daily;
    expect(rows).toHaveLength(14);
    expect(rows[13].day).toBe("2026-11-20");
  });

  it("caps distinct keys so hostile traffic cannot grow memory without bound", () => {
    for (let i = 0; i < 600; i++) record([{ type: "zone", name: `z${i}` }], "v", t0);
    expect(summary(t0).breakdown.zone.length).toBeLessThanOrEqual(400);
  });

  it("makes visitor ids that differ per day and never contain the IP", () => {
    const a = visitorHash("203.0.113.9", "UA", "secret", t0);
    const b = visitorHash("203.0.113.9", "UA", "secret", t0 + DAY);
    expect(a).not.toBe(b);
    expect(a).toBe(visitorHash("203.0.113.9", "UA", "secret", t0 + 1000));
    expect(a).not.toContain("203");
  });
});

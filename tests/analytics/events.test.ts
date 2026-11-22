import { describe, expect, it } from "vitest";
import { parseEvents } from "@/lib/analytics/events";

describe("parseEvents", () => {
  it("accepts well-formed events", () => {
    expect(parseEvents({ events: [{ type: "zone", name: "projects" }, { type: "pageview", name: "/play" }, { type: "oracle", name: "ur" }] })).toHaveLength(3);
  });
  it("defaults a missing name", () => {
    expect(parseEvents({ events: [{ type: "contact" }] })).toEqual([{ type: "contact", name: "-" }]);
  });
  it.each([
    ["not an object", "x"],
    ["array body", []],
    ["no events", { events: [] }],
    ["too many events", { events: Array.from({ length: 11 }, () => ({ type: "zone", name: "a" })) }],
    ["unknown type", { events: [{ type: "keylog", name: "a" }] }],
    ["free text (spaces)", { events: [{ type: "oracle", name: "what is his phone number" }] }],
    ["email-like personal data", { events: [{ type: "contact", name: "me@example.com" }] }],
    ["script injection", { events: [{ type: "zone", name: "<script>" }] }],
    ["name too long", { events: [{ type: "zone", name: "a".repeat(41) }] }],
    ["non-string name", { events: [{ type: "zone", name: 5 }] }],
    ["one bad event poisons the batch", { events: [{ type: "zone", name: "ok" }, { type: "nope", name: "x" }] }],
  ])("rejects %s", (_label, body) => {
    expect(parseEvents(body)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { validateContact } from "@/lib/contact/schema";

const good = { name: "Ayesha Khan", email: "Ayesha@Example.com", subject: "Internship opportunity", message: "Hi Farrukh, we loved your portfolio and would like to talk." };

describe("contact validation", () => {
  it("accepts a good message and normalises it", () => {
    const r = validateContact({ ...good, name: "  Ayesha Khan  " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.email).toBe("ayesha@example.com");
      expect(r.data.name).toBe("Ayesha Khan");
    }
  });

  it.each([
    ["name", { name: "A" }],
    ["name", { name: "x".repeat(81) }],
    ["email", { email: "not-an-email" }],
    ["email", { email: "a@b" }],
    ["subject", { subject: "Hi" }],
    ["subject", { subject: "s".repeat(121) }],
    ["message", { message: "short" }],
    ["message", { message: "m".repeat(2001) }],
  ])("rejects a bad %s", (field, patch) => {
    const r = validateContact({ ...good, ...patch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[field as keyof typeof r.errors]).toBeTruthy();
  });

  it("rejects missing and non-string fields", () => {
    expect(validateContact({}).ok).toBe(false);
    expect(validateContact({ ...good, name: 42 }).ok).toBe(false);
    expect(validateContact(null).ok).toBe(false);
  });

  it.each([
    ["name", "Eve\r\nBcc: victim@example.com"],
    ["subject", "Hello\nBcc: victim@example.com"],
    ["email", "eve@example.com\r\nBcc: victim@example.com"],
  ])("blocks header injection through %s", (field, value) => {
    const r = validateContact({ ...good, [field]: value });
    expect(r.ok).toBe(false);
  });

  it("strips control characters but keeps line breaks in the message", () => {
    const r = validateContact({ ...good, message: "Line one\u0000 here.\r\nLine two\u0007 here." });
    expect(r.ok && r.data.message).toBe("Line one here.\nLine two here.");
  });
});

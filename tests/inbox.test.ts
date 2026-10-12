import { describe, expect, it } from "vitest";
import { isUnseen } from "@/lib/inbox";

const t = (iso: string) => new Date(iso);

describe("isUnseen", () => {
  it("is new when the user never opened the trip", () => {
    expect(isUnseen(t("2026-10-01T10:00:00Z"), undefined)).toBe(true);
  });

  it("is new when the event happened after the last visit", () => {
    expect(isUnseen(t("2026-10-02T10:00:00Z"), t("2026-10-01T10:00:00Z"))).toBe(true);
  });

  it("is not new once the user opened the trip after the event", () => {
    expect(isUnseen(t("2026-10-01T10:00:00Z"), t("2026-10-01T10:05:00Z"))).toBe(false);
  });

  it("is never new without an event", () => {
    expect(isUnseen(null, undefined)).toBe(false);
  });
});

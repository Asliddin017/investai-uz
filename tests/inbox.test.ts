import { describe, expect, it } from "vitest";
import { isUnseen, withUnseenFlag } from "@/lib/inbox";

const t = (iso: string) => new Date(iso);

describe("withUnseenFlag", () => {
  const entry = (createdById: string, createdAt: string, agreementId = "a1") => ({
    agreementId,
    createdById,
    createdAt: t(createdAt),
  });

  it("flags someone else's entry the user has not seen", () => {
    const [row] = withUnseenFlag([entry("author", "2026-10-02T10:00:00Z")], "approver", new Map());
    expect(row.unseen).toBe(true);
  });

  it("never flags the user's own entry", () => {
    const [row] = withUnseenFlag([entry("approver", "2026-10-02T10:00:00Z")], "approver", new Map());
    expect(row.unseen).toBe(false);
  });

  it("clears only entries older than the last visit to that agreement", () => {
    const seen = new Map([["a1", t("2026-10-02T12:00:00Z")]]);
    const rows = withUnseenFlag(
      [
        entry("author", "2026-10-02T10:00:00Z"),
        entry("author", "2026-10-02T13:00:00Z"),
        entry("author", "2026-10-02T10:00:00Z", "a2"),
      ],
      "approver",
      seen,
    );
    expect(rows.map((r) => r.unseen)).toEqual([false, true, true]);
  });

  it("keeps the original fields", () => {
    const [row] = withUnseenFlag([{ ...entry("author", "2026-10-02T10:00:00Z"), note: "ish" }], "approver", new Map());
    expect(row.note).toBe("ish");
  });
});

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

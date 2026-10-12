import { describe, expect, it } from "vitest";
import { amountInWords, groupAmount, normalizeAmount } from "@/lib/money";

describe("normalizeAmount", () => {
  it("drops the grouping spaces", () => {
    expect(normalizeAmount("15 000 000")).toBe("15000000");
  });

  it("accepts a comma as the decimal mark and keeps two decimals", () => {
    expect(normalizeAmount("1 500,756")).toBe("1500.75");
  });

  it("ignores letters, a second decimal mark and leading zeros", () => {
    expect(normalizeAmount("00a12.3.4")).toBe("12.34");
    expect(normalizeAmount(",5")).toBe("0.5");
  });

  it("keeps an empty field empty", () => {
    expect(normalizeAmount("")).toBe("");
  });
});

describe("groupAmount", () => {
  it("groups thousands with spaces", () => {
    expect(groupAmount("15000000")).toBe("15 000 000");
    expect(groupAmount("999")).toBe("999");
  });

  it("shows decimals after a comma", () => {
    expect(groupAmount("1500.5")).toBe("1 500,5");
    expect(groupAmount("1500.")).toBe("1 500,");
  });
});

describe("amountInWords", () => {
  it("names the size", () => {
    expect(amountInWords("15000000")).toBe("15 mln");
    expect(amountInWords("1500000000")).toBe("1,5 mlrd");
    expect(amountInWords("250000")).toBe("250 ming");
  });

  it("stays quiet for small or empty amounts", () => {
    expect(amountInWords("950")).toBe("");
    expect(amountInWords("")).toBe("");
  });
});

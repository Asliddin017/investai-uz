import { describe, expect, it } from "vitest";
import { moneyTotals, overallAbsorption, progressFromMoney, remainingAmount } from "@/lib/labels";

describe("progressFromMoney", () => {
  it("is the share of the sum that arrived", () => {
    expect(progressFromMoney(300, 100)).toBe(33);
  });

  it("shows 100% only when everything arrived", () => {
    expect(progressFromMoney(300, 299.99)).toBe(99);
    expect(progressFromMoney(300, 300)).toBe(100);
  });

  it("is zero for an empty sum", () => {
    expect(progressFromMoney(0, 0)).toBe(0);
  });
});

describe("remainingAmount", () => {
  it("is what has not arrived yet", () => {
    expect(remainingAmount({ amount: 300, absorbedAmount: 100 })).toBe(200);
  });

  it("does not drift on cents", () => {
    expect(remainingAmount({ amount: 0.3, absorbedAmount: 0.1 })).toBe(0.2);
  });
});

describe("moneyTotals", () => {
  it("adds up per currency and skips cancelled or sumless agreements", () => {
    expect(
      moneyTotals([
        { status: "ACTIVE", amount: 300, absorbedAmount: 100, currency: "USD" },
        { status: "COMPLETED", amount: 100, absorbedAmount: 100, currency: "USD" },
        { status: "ACTIVE", amount: 50, absorbedAmount: 0, currency: "EUR" },
        { status: "CANCELLED", amount: 999, absorbedAmount: 1, currency: "USD" },
        { status: "ACTIVE", amount: null, absorbedAmount: 0, currency: null },
      ]),
    ).toEqual([
      { currency: "USD", amount: 400, absorbed: 200, remaining: 200 },
      { currency: "EUR", amount: 50, absorbed: 0, remaining: 50 },
    ]);
  });
});

describe("overallAbsorption", () => {
  it("averages the agreements' percentages", () => {
    expect(overallAbsorption([{ status: "ACTIVE", progress: 50 }, { status: "COMPLETED", progress: 100 }])).toBe(75);
  });

  it("leaves cancelled agreements out", () => {
    expect(overallAbsorption([{ status: "CANCELLED", progress: 10 }, { status: "ACTIVE", progress: 40 }])).toBe(40);
  });

  it("rounds to a whole percent", () => {
    expect(overallAbsorption([{ status: "ACTIVE", progress: 0 }, { status: "ACTIVE", progress: 0 }, { status: "ACTIVE", progress: 5 }])).toBe(2);
  });

  it("weighs by money when every agreement has a sum in one currency", () => {
    const big = { status: "ACTIVE" as const, progress: 33, amount: 300, absorbedAmount: 100, currency: "USD" };
    const small = { status: "ACTIVE" as const, progress: 100, amount: 100, absorbedAmount: 100, currency: "USD" };
    expect(overallAbsorption([big, small])).toBe(50);
  });

  it("falls back to the average when currencies differ", () => {
    const usd = { status: "ACTIVE" as const, progress: 20, amount: 300, absorbedAmount: 60, currency: "USD" };
    const eur = { status: "ACTIVE" as const, progress: 40, amount: 100, absorbedAmount: 40, currency: "EUR" };
    expect(overallAbsorption([usd, eur])).toBe(30);
  });

  it("is zero when nothing counts", () => {
    expect(overallAbsorption([])).toBe(0);
    expect(overallAbsorption([{ status: "CANCELLED", progress: 90 }])).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { heuristicAnalysis, type AnalysisInput } from "@/lib/ai";

const doc = { title: "Shartnoma", partner: "X", documentType: "Shartnoma", deadline: "2027-01-01" };

const input: AnalysisInput = {
  title: "Safar",
  goal: "Maqsad",
  country: "Koreya",
  items: [
    { order: 1, title: "A", expectedResult: "a", result: "ACHIEVED", resultNote: null, failureReason: null, agreements: [doc] },
    { order: 2, title: "B", expectedResult: "b", result: "ACHIEVED", resultNote: null, failureReason: null, agreements: [] },
    { order: 3, title: "C", expectedResult: "c", result: "NOT_ACHIEVED", resultNote: null, failureReason: "Kechiktirildi", agreements: [] },
  ],
  extraAgreements: [{ title: "Qo'shimcha", partner: "Y", documentType: "Bitim" }],
};

describe("heuristicAnalysis", () => {
  it("scores documented results highest and failures at zero", () => {
    const r = heuristicAnalysis(input);
    expect(r.items.map((i) => i.score)).toEqual([100, 80, 0]);
    expect(r.score).toBe(60);
    expect(r.model).toBe("heuristic");
  });

  it("keeps off-plan agreements out of the score but mentions them", () => {
    const r = heuristicAnalysis(input);
    expect(r.extraAchievements).toContain("Qo'shimcha");
    expect(heuristicAnalysis({ ...input, extraAgreements: [] }).score).toBe(60);
  });

  it("recommends next steps for failed items", () => {
    expect(heuristicAnalysis(input).recommendations).toHaveLength(1);
  });
});

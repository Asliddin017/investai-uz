import { describe, expect, it } from "vitest";
import { nameKey, normalizeName, NAME_PATTERN } from "@/lib/names";

describe("names", () => {
  it("normalizes spacing and invisible characters", () => {
    expect(normalizeName("  Karimov ​  Akmal ")).toBe("Karimov Akmal");
  });

  it("treats look-alike spellings as the same person", () => {
    const k = nameKey("Karimov Akmal");
    for (const v of ["karimov  akmal", "Кarimov Akmal", "KARIMOV AKMAL", "Karimov​Akmal", "Kárimov Akmal"]) {
      expect(nameKey(v)).toBe(k);
    }
    expect(nameKey("G'ulomov")).toBe(nameKey("Gʻulomov"));
  });

  it("keeps different people apart", () => {
    expect(nameKey("Karimov Akmal")).not.toBe(nameKey("Karimov Akbar"));
  });

  it("accepts real Uzbek names and rejects markup", () => {
    expect(NAME_PATTERN.test("O'tkir G'ulomov")).toBe(true);
    expect(NAME_PATTERN.test("Тошматов Эркин")).toBe(true);
    expect(NAME_PATTERN.test("<b>Admin</b>")).toBe(false);
  });
});

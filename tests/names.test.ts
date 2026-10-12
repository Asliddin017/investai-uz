import { describe, expect, it } from "vitest";
import { isValidName, normalizeName } from "@/lib/names";

describe("names", () => {
  it("normalizes spacing and invisible format characters", () => {
    expect(normalizeName("  Karimov ​  Akmal ")).toBe("Karimov Akmal");
  });

  it("accepts real Uzbek names in either script", () => {
    for (const n of ["O'tkir G'ulomov", "Oʻtkir Gʻulomov", "Karimov Akmal", "Тошматов Эркин", "Ўролов Ғайрат"]) {
      expect(isValidName(normalizeName(n))).toBe(true);
    }
  });

  it("rejects mixed scripts, invisible letters and markup", () => {
    for (const n of ["Кarimov Akmal", "KarimovㅤAkmal", "Karimov⠀Akmal", "Karimοv Akmal", "<b>Admin</b>", "' - ."]) {
      expect(isValidName(normalizeName(n))).toBe(false);
    }
  });
});

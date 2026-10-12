import { describe, expect, it } from "vitest";
import { isValidName, nameKey, normalizeName } from "@/lib/names";

describe("names", () => {
  it("normalizes spacing and invisible format characters", () => {
    expect(normalizeName("  Karimov ​  Akmal ")).toBe("Karimov Akmal");
  });

  it("accepts real Uzbek names in either script", () => {
    for (const n of ["O'tkir G'ulomov", "Oʻtkir Gʻulomov", "Karimov Akmal", "Тошматов Эркин", "Ўролов Ғайрат"]) {
      expect(isValidName(normalizeName(n))).toBe(true);
    }
  });

  it("rejects mixed scripts, invisible letters and foreign look-alikes", () => {
    for (const n of [
      "Кarimov Akmal", // Cyrillic К inside a Latin name
      "KarimovㅤAkmal", // Hangul filler
      "Karimov⠀Akmal", // Braille blank
      "Karimοv Akmal", // Greek omicron
      "Kárimov Akmal", // accented letter
      "<b>Admin</b>",
      "' - .",
    ]) {
      expect(isValidName(normalizeName(n))).toBe(false);
    }
  });

  it("matches the same name across case, spacing, apostrophes and script", () => {
    const k = nameKey("Karimov Akmal");
    for (const v of ["karimov  akmal", "KARIMOV AKMAL", "Каримов Акмал"]) expect(nameKey(v)).toBe(k);
    expect(nameKey("G'ulomov")).toBe(nameKey("Gʻulomov"));
    expect(nameKey("Karimov Akmal")).not.toBe(nameKey("Karimov Akbar"));
  });
});

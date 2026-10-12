/** Letters, spaces and the punctuation real Uzbek/Russian names use (apostrophe variants, hyphen, dot). */
export const NAME_PATTERN = /^[\p{L}\p{M} '’‘ʻʼ`.-]+$/u;

/** Canonical display form: NFKC, no invisible/control characters, single spaces. */
export function normalizeName(input: string) {
  return input
    .normalize("NFKC")
    .replace(/[\p{Cf}\p{Cc}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Cyrillic letters that render like Latin ones.
const HOMOGLYPHS: Record<string, string> = {
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x",
  і: "i", ј: "j", ѕ: "s", ԁ: "d", ԛ: "q", ԝ: "w", ү: "y", һ: "h", ӏ: "l",
};

/**
 * Comparison key: two names that look the same to a reader map to the same key
 * (case, spacing, apostrophe style, diacritics and Cyrillic look-alikes are ignored).
 */
export function nameKey(input: string) {
  return normalizeName(input)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/./gu, (ch) => HOMOGLYPHS[ch] ?? ch)
    // ʻ and ʼ are Unicode letters, not punctuation, so drop them explicitly.
    .replace(/[ʻʼ]/gu, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

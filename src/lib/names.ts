/**
 * A name is written entirely in the Uzbek Latin alphabet or entirely in Cyrillic — an explicit
 * allowlist, so no look-alike letter from another script and no invisible "letter"
 * (Hangul filler, Braille blank, ...) can slip in, and scripts cannot be mixed.
 */
const PUNCT = "'’‘ʻʼ`.\\- ";
const LATIN_NAME = new RegExp(`^[A-Za-z${PUNCT}]+$`);
const CYRILLIC_NAME = new RegExp(`^[А-Яа-яЁёЎўҚқҒғҲҳ${PUNCT}]+$`);

export function isValidName(name: string) {
  return /\p{L}/u.test(name) && (LATIN_NAME.test(name) || CYRILLIC_NAME.test(name));
}

/** Canonical display form: NFKC, no invisible/control characters, single spaces. */
export function normalizeName(input: string) {
  return input
    .normalize("NFKC")
    .replace(/[\p{Cf}\p{Cc}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Uzbek Cyrillic → Latin, so "Каримов" and "Karimov" are recognised as the same name.
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k",
  л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts",
  ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

// Cyrillic letters that render like Latin ones (upper or lower case).
const CYRILLIC_LOOKALIKE: Record<string, string> = {
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x",
};

function base(input: string) {
  return normalizeName(input).toLowerCase();
}

/** Comparison key by sound: case, spacing, apostrophes and the script used are ignored. */
export function nameKey(input: string) {
  return base(input)
    .replace(/./gu, (ch) => CYRILLIC_TO_LATIN[ch] ?? ch)
    .replace(/[^a-z]/g, "");
}

/** Comparison key by look: a Cyrillic name that renders like a Latin one maps to that Latin text. */
export function visualKey(input: string) {
  return base(input)
    .replace(/./gu, (ch) => CYRILLIC_LOOKALIKE[ch] ?? ch)
    .replace(/[^\p{L}]/gu, "")
    .replace(/[ʻʼ]/gu, "");
}

/** True when two names would read or look the same to a person. */
export function namesCollide(a: string, b: string) {
  return nameKey(a) === nameKey(b) || visualKey(a) === visualKey(b);
}

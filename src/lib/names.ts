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

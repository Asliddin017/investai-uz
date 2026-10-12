/**
 * Helpers for the amount field: people type "15000000" and lose count of the zeros, so
 * the field shows "15 000 000" while the form keeps the plain number string.
 */

/** Whatever the user typed (spaces, comma as decimal mark) → a plain number string like "1500.5". */
export function normalizeAmount(typed: string) {
  const cleaned = typed.replace(/\s/g, "").replace(/,/g, ".").replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  let int = dot === -1 ? cleaned : cleaned.slice(0, dot);
  const frac = dot === -1 ? null : cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  int = int.replace(/^0+(?=\d)/, "");
  if (frac !== null && int === "") int = "0";
  return frac === null ? int : `${int}.${frac}`;
}

/** "15000000.5" → "15 000 000,5" */
export function groupAmount(raw: string) {
  if (!raw) return "";
  const [int, frac] = raw.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return frac === undefined ? grouped : `${grouped},${frac}`;
}

/** A short spoken form to double-check the size: "15 mln", "1,5 mlrd", "250 ming". */
export function amountInWords(raw: string) {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n < 1000) return "";
  const units: [number, string][] = [
    [1e12, "trln"],
    [1e9, "mlrd"],
    [1e6, "mln"],
    [1e3, "ming"],
  ];
  const [size, word] = units.find(([size]) => n >= size)!;
  const value = Math.round((n / size) * 100) / 100;
  return `${String(value).replace(".", ",")} ${word}`;
}

import { useLayoutEffect, useRef } from "react";
import { amountInWords, groupAmount, normalizeAmount } from "@/lib/money";
import { Input } from "./ui";

/** Digits and the decimal mark: the characters that survive formatting. */
const significant = (s: string) => s.replace(/[^\d.,]/g, "").length;

/**
 * A money field that shows "15 000 000" while typing and reports the plain number
 * string ("15000000") through onChange. The caret stays after the same digit.
 */
export function AmountInput({ value, onChange }: { value: string; onChange: (raw: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const shown = groupAmount(value);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || caret.current === null || document.activeElement !== el) return;
    // Put the caret after the same number of digits it followed before formatting.
    let pos = 0;
    for (let seen = 0; pos < shown.length && seen < caret.current; pos++) {
      if (/[\d,]/.test(shown[pos])) seen++;
    }
    el.setSelectionRange(pos, pos);
    caret.current = null;
  }, [shown]);

  const words = amountInWords(value);
  return (
    <div>
      <Input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        value={shown}
        placeholder="Masalan: 15 000 000"
        onChange={(e) => {
          const typed = e.target.value;
          caret.current = significant(typed.slice(0, e.target.selectionStart ?? typed.length));
          onChange(normalizeAmount(typed));
        }}
      />
      {words && <div className="mt-1 text-xs text-muted-foreground">≈ {words}</div>}
    </div>
  );
}

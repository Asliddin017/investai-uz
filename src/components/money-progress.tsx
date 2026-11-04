import { compactMoney } from "@/lib/money";
import { ProgressBar } from "./ui";

/** An agreement's percentage and, when it has a sum, how much of that sum has arrived. */
export function MoneyProgress({
  a,
}: {
  a: { progress: number; amount: number | null; absorbedAmount: number; currency: string | null };
}) {
  return (
    <div className="min-w-[150px]">
      <div className="flex items-center gap-2">
        <ProgressBar value={a.progress} />
        <span className="text-xs tabular-nums">{a.progress}%</span>
      </div>
      {a.amount !== null && (
        <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          <b className="text-foreground">{compactMoney(a.absorbedAmount)}</b> / {compactMoney(a.amount, a.currency)} tushdi
        </div>
      )}
    </div>
  );
}

import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatPercent, type PeriodReturn } from "@/lib/utils";

export function PeriodReturnBadge({ periodReturn }: { periodReturn: PeriodReturn | null }) {
  if (!periodReturn) return null;
  const isPositive = periodReturn.changeValue >= 0;
  const colorClass = isPositive ? "text-green-500" : "text-red-500";
  const Icon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div className={`flex items-center gap-1.5 text-sm font-medium ${colorClass}`} data-testid="text-period-return">
      <Icon className="h-4 w-4" />
      <span>
        {isPositive ? "+" : ""}
        {formatCurrency(periodReturn.changeValue)}
      </span>
      <span>
        ({isPositive ? "+" : ""}
        {formatPercent(periodReturn.changePercent)})
      </span>
    </div>
  );
}

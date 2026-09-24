import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency: string = "LKR") {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${(value).toFixed(2)}%`;
}

export interface PeriodReturn {
  startDate: string;
  endDate: string;
  startValue: number;
  endValue: number;
  changeValue: number;
  changePercent: number;
}

/**
 * Period return = market gain over the period, i.e. the change in totalValue
 * MINUS the change in invested capital (so new deposits/SIPs/deployments
 * during the period aren't counted as "return").
 */
export function computePeriodReturn(
  growth: Array<{ date: string; totalValue: number; invested: number }> | undefined,
): PeriodReturn | null {
  if (!growth || growth.length === 0) return null;
  const first = growth[0];
  const last = growth[growth.length - 1];
  const valueChange = last.totalValue - first.totalValue;
  const investedChange = last.invested - first.invested;
  const changeValue = valueChange - investedChange;
  const changePercent = first.totalValue > 0 ? (changeValue / first.totalValue) * 100 : 0;
  return {
    startDate: first.date,
    endDate: last.date,
    startValue: first.totalValue,
    endValue: last.totalValue,
    changeValue,
    changePercent,
  };
}

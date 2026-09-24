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

const PERIOD_DAYS: Record<string, number> = { "1d": 1, "1w": 7, "1m": 30, "3m": 90, "6m": 180, "1y": 365 };

/**
 * Cutoff date (YYYY-MM-DD, local calendar day) for a timeframe period, or
 * null for "all". Computed entirely in local calendar-day space (not via
 * exact-instant subtraction + UTC truncation) so the window is a clean N
 * calendar days regardless of what time of day it's checked.
 */
export function getPeriodCutoffDate(period: string, today: Date = new Date()): string | null {
  const days = PERIOD_DAYS[period];
  if (!days) return null;
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  const y = cutoff.getFullYear();
  const m = String(cutoff.getMonth() + 1).padStart(2, "0");
  const d = String(cutoff.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

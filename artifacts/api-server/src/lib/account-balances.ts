import { db, accountValuationsTable, type accountsTable } from "@workspace/db";
import { desc, inArray } from "drizzle-orm";

type AccountRow = typeof accountsTable.$inferSelect;
type ValuationRow = typeof accountValuationsTable.$inferSelect;

/**
 * Fetch the latest valuation for each account in a single query.
 * Returns a Map keyed by accountId.
 */
export async function getLatestAccountValuationsMap(
  accountIds: number[],
): Promise<Map<number, ValuationRow>> {
  if (accountIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(accountValuationsTable)
    .where(inArray(accountValuationsTable.accountId, accountIds))
    .orderBy(desc(accountValuationsTable.date), desc(accountValuationsTable.id));
  const map = new Map<number, ValuationRow>();
  for (const v of rows) {
    if (!map.has(v.accountId)) map.set(v.accountId, v);
  }
  return map;
}

/**
 * Effective balance for an account = latest valuation value if present,
 * otherwise the principal (account.balance).
 */
export function effectiveAccountBalance(
  account: AccountRow,
  latestValuation?: ValuationRow | null,
): number {
  return latestValuation ? Number(latestValuation.value) : Number(account.balance);
}

/**
 * Sum of effective balances for the given accounts using the provided
 * latest-valuation map.
 */
export function sumEffectiveBalances(
  accounts: AccountRow[],
  latestMap: Map<number, ValuationRow>,
): number {
  return accounts.reduce(
    (sum, a) => sum + effectiveAccountBalance(a, latestMap.get(a.id)),
    0,
  );
}

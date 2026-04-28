import { Router } from "express";
import { db, accountsTable, accountValuationsTable, transactionsTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import {
  getLatestAccountValuationsMap,
  effectiveAccountBalance,
} from "../lib/account-balances";
import { CreateAccountBody, UpdateAccountBody, AddAccountValuationBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

type AccountRow = typeof accountsTable.$inferSelect;
type ValuationRow = typeof accountValuationsTable.$inferSelect;

function formatAccount(a: AccountRow, latestVal?: ValuationRow | null) {
  const principal = Number(a.principal);
  const currentBalance = latestVal ? Number(latestVal.value) : principal;
  const interestEarned = latestVal ? currentBalance - principal : 0;
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    subCategory: a.subCategory,
    tag: a.tag,
    balance: principal,
    currentBalance,
    interestEarned,
    currency: a.currency,
    isActive: a.isActive,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

function formatValuation(v: ValuationRow) {
  return {
    id: v.id,
    accountId: v.accountId,
    value: Number(v.value),
    date: v.date,
    note: v.note,
    createdAt: v.createdAt.toISOString(),
  };
}

router.get("/summary", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const accounts = await db.select().from(accountsTable).where(and(eq(accountsTable.userId, userId), eq(accountsTable.isActive, true)));

  const latestMap = await getLatestAccountValuationsMap(accounts.map((a) => a.id));
  const effBalance = (a: AccountRow) => effectiveAccountBalance(a, latestMap.get(a.id));

  const totalBalance     = accounts.reduce((s, a) => s + effBalance(a), 0);
  const emergencyFund    = accounts.filter((a) => a.tag === "emergency").reduce((s, a) => s + effBalance(a), 0);
  const opportunityFund  = accounts.filter((a) => a.tag === "opportunity").reduce((s, a) => s + effBalance(a), 0);
  const freeCash         = accounts.filter((a) => a.tag === "free").reduce((s, a) => s + effBalance(a), 0);

  // Calculate monthly inflow/outflow from transactions this month
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const txs = await db.select().from(transactionsTable).where(and(eq(transactionsTable.userId, userId), gte(transactionsTable.date, monthStart)));
  const monthlyInflow = txs.filter((t) => ["deposit", "invest"].includes(t.type)).reduce((s, t) => s + Number(t.amount), 0);
  const monthlyOutflow = txs.filter((t) => ["withdrawal", "redeem"].includes(t.type)).reduce((s, t) => s + Number(t.amount), 0);

  res.json({ totalBalance, emergencyFund, opportunityFund, freeCash, monthlyInflow, monthlyOutflow });
});

router.get("/", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const accounts = await db.select().from(accountsTable).where(eq(accountsTable.userId, userId));
  const latestMap = await getLatestAccountValuationsMap(accounts.map((a) => a.id));
  res.json(accounts.map((a) => formatAccount(a, latestMap.get(a.id))));
});

router.post("/", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const { name, type, subCategory, tag, balance, currency } = parsed.data;
  const [acc] = await db.insert(accountsTable).values({
    userId, name, type,
    subCategory: subCategory ?? null,
    tag,
    // On create, principal and balance both start at the entered amount.
    // Transactions later mutate `balance` (ledger) but not `principal` (snapshot).
    principal: balance.toString(),
    balance: balance.toString(),
    currency: currency || "LKR",
  }).returning();

  res.status(201).json(formatAccount(acc, null));
});

router.patch("/:id", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = UpdateAccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name        !== undefined) updates.name        = parsed.data.name;
  if (parsed.data.type        !== undefined) updates.type        = parsed.data.type;
  if (parsed.data.subCategory !== undefined) updates.subCategory = parsed.data.subCategory;
  if (parsed.data.tag         !== undefined) updates.tag         = parsed.data.tag;
  if (parsed.data.balance     !== undefined) {
    // Editing the principal via the account form updates BOTH principal (the
    // snapshot used for interest calc) and balance (the ledger). This lets
    // users correct an account whose ledger has drifted from real-world value.
    updates.principal = parsed.data.balance.toString();
    updates.balance   = parsed.data.balance.toString();
  }
  if (parsed.data.isActive    !== undefined) updates.isActive    = parsed.data.isActive;

  const [acc] = await db.update(accountsTable).set(updates).where(and(eq(accountsTable.id, id), eq(accountsTable.userId, userId))).returning();
  if (!acc) { res.status(404).json({ error: "Account not found" }); return; }

  const latest = await db.select().from(accountValuationsTable)
    .where(eq(accountValuationsTable.accountId, id))
    .orderBy(desc(accountValuationsTable.date), desc(accountValuationsTable.id)).limit(1);
  res.json(formatAccount(acc, latest[0] ?? null));
});

router.delete("/:id", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [deleted] = await db.delete(accountsTable).where(and(eq(accountsTable.id, id), eq(accountsTable.userId, userId))).returning();
  if (!deleted) { res.status(404).json({ error: "Account not found" }); return; }

  res.json({ message: "Account deleted" });
});

// ── Account Valuations (interest snapshots) ────────────────────────────────

async function ensureAccount(id: number, userId: number) {
  const [acc] = await db.select().from(accountsTable)
    .where(and(eq(accountsTable.id, id), eq(accountsTable.userId, userId))).limit(1);
  return acc;
}

router.get("/:id/valuations", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const acc = await ensureAccount(id, userId);
  if (!acc) { res.status(404).json({ error: "Account not found" }); return; }

  const vals = await db.select().from(accountValuationsTable)
    .where(eq(accountValuationsTable.accountId, id))
    .orderBy(desc(accountValuationsTable.date), desc(accountValuationsTable.id));
  res.json(vals.map(formatValuation));
});

router.post("/:id/valuations", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const acc = await ensureAccount(id, userId);
  if (!acc) { res.status(404).json({ error: "Account not found" }); return; }

  const parsed = AddAccountValuationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const { value, date, note } = parsed.data;
  const [val] = await db.insert(accountValuationsTable).values({
    accountId: id,
    value: value.toString(),
    date,
    note: note ?? null,
  }).returning();

  res.status(201).json(formatValuation(val));
});

router.patch("/:id/valuations/:valuationId", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  const valuationId = parseInt(req.params.valuationId as string);
  if (isNaN(id) || isNaN(valuationId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const acc = await ensureAccount(id, userId);
  if (!acc) { res.status(404).json({ error: "Account not found" }); return; }

  const parsed = AddAccountValuationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const { value, date, note } = parsed.data;
  const [val] = await db.update(accountValuationsTable).set({
    value: value.toString(),
    date,
    note: note ?? null,
  }).where(and(eq(accountValuationsTable.id, valuationId), eq(accountValuationsTable.accountId, id))).returning();

  if (!val) { res.status(404).json({ error: "Valuation not found" }); return; }
  res.json(formatValuation(val));
});

router.delete("/:id/valuations/:valuationId", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  const valuationId = parseInt(req.params.valuationId as string);
  if (isNaN(id) || isNaN(valuationId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const acc = await ensureAccount(id, userId);
  if (!acc) { res.status(404).json({ error: "Account not found" }); return; }

  const [del] = await db.delete(accountValuationsTable)
    .where(and(eq(accountValuationsTable.id, valuationId), eq(accountValuationsTable.accountId, id)))
    .returning();
  if (!del) { res.status(404).json({ error: "Valuation not found" }); return; }

  res.json({ message: "Valuation deleted" });
});

export default router;

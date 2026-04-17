import { Router } from "express";
import { db, accountsTable, transactionsTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { CreateAccountBody, UpdateAccountBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

function formatAccount(a: typeof accountsTable.$inferSelect) {
  return {
    id: a.id, name: a.name, type: a.type, tag: a.tag,
    balance: Number(a.balance), currency: a.currency,
    isActive: a.isActive,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

router.get("/summary", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const accounts = await db.select().from(accountsTable).where(and(eq(accountsTable.userId, userId), eq(accountsTable.isActive, true)));

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const emergencyFund = accounts.filter(a => a.tag === "emergency").reduce((s, a) => s + Number(a.balance), 0);
  const opportunityFund = accounts.filter(a => a.tag === "opportunity").reduce((s, a) => s + Number(a.balance), 0);
  const freeCash = accounts.filter(a => a.tag === "free").reduce((s, a) => s + Number(a.balance), 0);

  // Calculate monthly inflow/outflow from transactions this month
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const txs = await db.select().from(transactionsTable).where(and(eq(transactionsTable.userId, userId), gte(transactionsTable.date, monthStart)));

  const monthlyInflow = txs.filter(t => ["deposit", "invest"].includes(t.type)).reduce((s, t) => s + Number(t.amount), 0);
  const monthlyOutflow = txs.filter(t => ["withdrawal", "redeem"].includes(t.type)).reduce((s, t) => s + Number(t.amount), 0);

  res.json({ totalBalance, emergencyFund, opportunityFund, freeCash, monthlyInflow, monthlyOutflow });
});

router.get("/", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const accounts = await db.select().from(accountsTable).where(eq(accountsTable.userId, userId));
  res.json(accounts.map(formatAccount));
});

router.post("/", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const { name, type, tag, balance, currency } = parsed.data;
  const [acc] = await db.insert(accountsTable).values({
    userId, name, type, tag,
    balance: balance.toString(),
    currency: currency || "LKR",
  }).returning();

  res.status(201).json(formatAccount(acc));
});

router.patch("/:id", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = UpdateAccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.type !== undefined) updates.type = parsed.data.type;
  if (parsed.data.tag !== undefined) updates.tag = parsed.data.tag;
  if (parsed.data.balance !== undefined) updates.balance = parsed.data.balance.toString();
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  const [acc] = await db.update(accountsTable).set(updates).where(and(eq(accountsTable.id, id), eq(accountsTable.userId, userId))).returning();
  if (!acc) { res.status(404).json({ error: "Account not found" }); return; }

  res.json(formatAccount(acc));
});

router.delete("/:id", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [deleted] = await db.delete(accountsTable).where(and(eq(accountsTable.id, id), eq(accountsTable.userId, userId))).returning();
  if (!deleted) { res.status(404).json({ error: "Account not found" }); return; }

  res.json({ message: "Account deleted" });
});

export default router;

import { Router } from "express";
import { db, transactionsTable, assetsTable, accountsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { CreateTransactionBody, UpdateTransactionBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

function formatTx(t: typeof transactionsTable.$inferSelect, assetName?: string | null) {
  return {
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    assetId: t.assetId,
    assetName: assetName ?? null,
    sourceAccountId: t.sourceAccountId,
    destinationAccountId: t.destinationAccountId,
    date: t.date,
    tag: t.tag,
    note: t.note,
    createdAt: t.createdAt.toISOString(),
  };
}

/**
 * Apply account balance changes for a transaction.
 * direction: +1 = apply (on create), -1 = reverse (on delete)
 */
async function applyAccountBalances(
  tx: { type: string; amount: string; sourceAccountId: number | null; destinationAccountId: number | null },
  direction: 1 | -1
): Promise<void> {
  const amount = Number(tx.amount) * direction;

  switch (tx.type) {
    case "deposit":
      // Money arrives into destination account
      if (tx.destinationAccountId) {
        await db
          .update(accountsTable)
          .set({ balance: sql`${accountsTable.balance} + ${amount.toString()}` })
          .where(eq(accountsTable.id, tx.destinationAccountId));
      }
      break;

    case "withdrawal":
      // Money leaves from source account (direction=1 reduces, direction=-1 restores)
      if (tx.sourceAccountId) {
        await db
          .update(accountsTable)
          .set({ balance: sql`${accountsTable.balance} + ${(-amount).toString()}` })
          .where(eq(accountsTable.id, tx.sourceAccountId));
      }
      break;

    case "transfer":
    case "tag_allocation":
      // Money moves from source to destination
      if (tx.sourceAccountId) {
        await db
          .update(accountsTable)
          .set({ balance: sql`${accountsTable.balance} + ${(-amount).toString()}` })
          .where(eq(accountsTable.id, tx.sourceAccountId));
      }
      if (tx.destinationAccountId) {
        await db
          .update(accountsTable)
          .set({ balance: sql`${accountsTable.balance} + ${amount.toString()}` })
          .where(eq(accountsTable.id, tx.destinationAccountId));
      }
      break;

    case "invest":
    case "sip":
      // Cash leaves source account to go into investment
      if (tx.sourceAccountId) {
        await db
          .update(accountsTable)
          .set({ balance: sql`${accountsTable.balance} + ${(-amount).toString()}` })
          .where(eq(accountsTable.id, tx.sourceAccountId));
      }
      break;

    case "redeem":
      // Cash comes back from investment into destination account
      if (tx.destinationAccountId) {
        await db
          .update(accountsTable)
          .set({ balance: sql`${accountsTable.balance} + ${amount.toString()}` })
          .where(eq(accountsTable.id, tx.destinationAccountId));
      }
      break;
  }
}

router.get("/", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const { type, assetId, startDate, endDate, limit, offset } = req.query as Record<string, string>;

  let txs = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .orderBy(desc(transactionsTable.date));

  if (type) txs = txs.filter((t) => t.type === type);
  if (assetId) txs = txs.filter((t) => t.assetId === parseInt(assetId));
  if (startDate) txs = txs.filter((t) => t.date >= startDate);
  if (endDate) txs = txs.filter((t) => t.date <= endDate);

  const off = offset ? parseInt(offset) : 0;
  const lim = limit ? parseInt(limit) : txs.length;
  txs = txs.slice(off, off + lim);

  const assetIds = [...new Set(txs.filter((t) => t.assetId).map((t) => t.assetId!))];
  const assets = assetIds.length > 0 ? await db.select().from(assetsTable).where(eq(assetsTable.userId, userId)) : [];
  const assetMap = new Map(assets.map((a) => [a.id, a.name]));

  res.json(txs.map((t) => formatTx(t, t.assetId ? assetMap.get(t.assetId) : null)));
});

router.post("/", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { type, amount, assetId, sourceAccountId, destinationAccountId, date, tag, note } = parsed.data;

  const [tx] = await db
    .insert(transactionsTable)
    .values({
      userId,
      type,
      amount: amount.toString(),
      assetId: assetId ?? null,
      sourceAccountId: sourceAccountId ?? null,
      destinationAccountId: destinationAccountId ?? null,
      date,
      tag: tag ?? null,
      note: note ?? null,
    })
    .returning();

  // Apply account balance side-effects
  await applyAccountBalances(tx, 1);

  let assetName: string | null = null;
  if (tx.assetId) {
    const [a] = await db.select().from(assetsTable).where(eq(assetsTable.id, tx.assetId)).limit(1);
    assetName = a?.name ?? null;
  }

  res.status(201).json(formatTx(tx, assetName));
});

router.get("/:id", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [tx] = await db
    .select()
    .from(transactionsTable)
    .where(and(eq(transactionsTable.id, id), eq(transactionsTable.userId, userId)))
    .limit(1);
  if (!tx) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  let assetName: string | null = null;
  if (tx.assetId) {
    const [a] = await db.select().from(assetsTable).where(eq(assetsTable.id, tx.assetId)).limit(1);
    assetName = a?.name ?? null;
  }

  res.json(formatTx(tx, assetName));
});

router.patch("/:id", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = UpdateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  // Fetch existing tx to reverse its balance effects before applying new
  const [existing] = await db
    .select()
    .from(transactionsTable)
    .where(and(eq(transactionsTable.id, id), eq(transactionsTable.userId, userId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  // Reverse old balance effects
  await applyAccountBalances(existing, -1);

  const updates: Record<string, unknown> = {};
  if (parsed.data.type !== undefined) updates.type = parsed.data.type;
  if (parsed.data.amount !== undefined) updates.amount = parsed.data.amount.toString();
  if (parsed.data.assetId !== undefined) updates.assetId = parsed.data.assetId ?? null;
  if (parsed.data.sourceAccountId !== undefined) updates.sourceAccountId = parsed.data.sourceAccountId ?? null;
  if (parsed.data.destinationAccountId !== undefined) updates.destinationAccountId = parsed.data.destinationAccountId ?? null;
  if (parsed.data.date !== undefined) updates.date = parsed.data.date;
  if (parsed.data.tag !== undefined) updates.tag = parsed.data.tag ?? null;
  if (parsed.data.note !== undefined) updates.note = parsed.data.note ?? null;

  const [tx] = await db
    .update(transactionsTable)
    .set(updates)
    .where(and(eq(transactionsTable.id, id), eq(transactionsTable.userId, userId)))
    .returning();
  if (!tx) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  // Apply new balance effects
  await applyAccountBalances(tx, 1);

  let assetName: string | null = null;
  if (tx.assetId) {
    const [a] = await db.select().from(assetsTable).where(eq(assetsTable.id, tx.assetId)).limit(1);
    assetName = a?.name ?? null;
  }

  res.json(formatTx(tx, assetName));
});

router.delete("/:id", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [existing] = await db
    .select()
    .from(transactionsTable)
    .where(and(eq(transactionsTable.id, id), eq(transactionsTable.userId, userId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  // Reverse balance effects before deleting
  await applyAccountBalances(existing, -1);

  await db.delete(transactionsTable).where(and(eq(transactionsTable.id, id), eq(transactionsTable.userId, userId)));

  res.json({ message: "Transaction deleted" });
});

export default router;

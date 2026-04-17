import { Router } from "express";
import { db, sipConfigsTable, sipHistoryTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { UpdateSipConfigBody, RecordSipExecutionBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

function formatConfig(c: typeof sipConfigsTable.$inferSelect) {
  return {
    id: c.id,
    monthlyAmount: Number(c.monthlyAmount),
    equityPercent: Number(c.equityPercent),
    debtPercent: Number(c.debtPercent),
    metalsPercent: Number(c.metalsPercent),
    opportunityPercent: Number(c.opportunityPercent),
    assetAllocations: (c.assetAllocations as unknown[]) || [],
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.get("/", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  let [config] = await db.select().from(sipConfigsTable).where(eq(sipConfigsTable.userId, userId)).limit(1);
  if (!config) {
    const [newConfig] = await db.insert(sipConfigsTable).values({ userId }).returning();
    config = newConfig;
  }
  res.json(formatConfig(config));
});

router.put("/", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const parsed = UpdateSipConfigBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const { monthlyAmount, equityPercent, debtPercent, metalsPercent, opportunityPercent, assetAllocations } = parsed.data;
  const total = equityPercent + debtPercent + metalsPercent + opportunityPercent;
  if (Math.abs(total - 100) > 0.01) {
    res.status(400).json({ error: "Category percentages must sum to 100" });
    return;
  }

  let [config] = await db.select().from(sipConfigsTable).where(eq(sipConfigsTable.userId, userId)).limit(1);
  if (!config) {
    const [newConfig] = await db.insert(sipConfigsTable).values({
      userId,
      monthlyAmount: monthlyAmount.toString(),
      equityPercent: equityPercent.toString(),
      debtPercent: debtPercent.toString(),
      metalsPercent: metalsPercent.toString(),
      opportunityPercent: opportunityPercent.toString(),
      assetAllocations: assetAllocations as unknown as string,
    }).returning();
    config = newConfig;
  } else {
    const [updated] = await db.update(sipConfigsTable).set({
      monthlyAmount: monthlyAmount.toString(),
      equityPercent: equityPercent.toString(),
      debtPercent: debtPercent.toString(),
      metalsPercent: metalsPercent.toString(),
      opportunityPercent: opportunityPercent.toString(),
      assetAllocations: assetAllocations as unknown as string,
    }).where(eq(sipConfigsTable.userId, userId)).returning();
    config = updated;
  }

  res.json(formatConfig(config));
});

router.get("/history", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const history = await db.select().from(sipHistoryTable).where(eq(sipHistoryTable.userId, userId)).orderBy(desc(sipHistoryTable.month));
  res.json(history.map(h => ({
    id: h.id, month: h.month, totalAmount: Number(h.totalAmount),
    breakdown: (h.breakdown as unknown[]) || [],
    executedAt: h.executedAt.toISOString(),
  })));
});

router.post("/history", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const parsed = RecordSipExecutionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const { month, totalAmount, breakdown } = parsed.data;
  const [entry] = await db.insert(sipHistoryTable).values({
    userId, month,
    totalAmount: totalAmount.toString(),
    breakdown: breakdown as unknown as string,
  }).returning();

  res.status(201).json({
    id: entry.id, month: entry.month, totalAmount: Number(entry.totalAmount),
    breakdown: (entry.breakdown as unknown[]) || [],
    executedAt: entry.executedAt.toISOString(),
  });
});

export default router;

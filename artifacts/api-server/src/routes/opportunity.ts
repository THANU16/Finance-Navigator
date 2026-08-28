import { Router } from "express";
import {
  db,
  accountsTable,
  deploymentsTable,
  settingsTable,
  assetsTable,
  transactionsTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { RecordDeploymentBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const accounts = await db
    .select()
    .from(accountsTable)
    .where(
      and(
        eq(accountsTable.userId, userId),
        eq(accountsTable.tag, "opportunity"),
        eq(accountsTable.isActive, true),
      ),
    );
  const availableAmount = accounts.reduce((s, a) => s + Number(a.balance), 0);

  const deployments = await db
    .select()
    .from(deploymentsTable)
    .where(eq(deploymentsTable.userId, userId));
  const totalDeployed = deployments.reduce(
    (s, d) => s + Number(d.deployedAmount),
    0,
  );

  const [settings] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.userId, userId))
    .limit(1);
  const dropLevels = settings
    ? (settings.crashDropLevels as number[])
    : [10, 15, 20, 25];
  const strategy = settings
    ? (settings.crashDeploymentStrategy as Record<string, number>)
    : { "10": 25, "15": 50, "20": 75, "25": 100 };

  const stages = dropLevels.map((level) => {
    const deployPct = strategy[level.toString()] || 0;
    const deployAmount = (availableAmount * deployPct) / 100;
    const triggered = deployments.some((d) => Number(d.dropPercent) === level);
    const trigDeploy = deployments.find((d) => Number(d.dropPercent) === level);
    return {
      dropPercent: level,
      deployPercent: deployPct,
      deployAmount,
      triggered,
      triggeredAt:
        triggered && trigDeploy ? trigDeploy.deployedAt.toISOString() : null,
    };
  });

  res.json({ availableAmount, totalDeployed, stages });
});

router.get("/deployments", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const deps = await db
    .select()
    .from(deploymentsTable)
    .where(eq(deploymentsTable.userId, userId))
    .orderBy(desc(deploymentsTable.deployedAt));

  res.json(
    deps.map((d) => ({
      id: d.id,
      dropPercent: Number(d.dropPercent),
      deployedAmount: Number(d.deployedAmount),
      allocations: (d.allocations as unknown[]) || [],
      note: d.note,
      deployedAt: d.deployedAt.toISOString(),
    })),
  );
});

router.post("/deployments", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const parsed = RecordDeploymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { dropPercent, sourceAccountId, allocations, note, deployedAt } =
    parsed.data;

  if (!allocations.length) {
    res.status(400).json({ error: "At least one allocation is required" });
    return;
  }
  const totalAmount = allocations.reduce((s, a) => s + a.amount, 0);
  if (totalAmount <= 0) {
    res
      .status(400)
      .json({ error: "Total deployed amount must be greater than 0" });
    return;
  }

  // Resolve asset names for storage
  const assetIds = [
    ...new Set(
      allocations
        .map((a) => a.assetId)
        .filter((id): id is number => id != null),
    ),
  ];
  const assetRows =
    assetIds.length > 0
      ? await db
          .select()
          .from(assetsTable)
          .where(eq(assetsTable.userId, userId))
      : [];
  const assetMap = new Map(assetRows.map((a) => [a.id, a.name]));

  const richAllocations = allocations.map((a) => ({
    assetId: a.assetId ?? null,
    assetName: a.assetId ? (assetMap.get(a.assetId) ?? null) : null,
    amount: a.amount,
  }));

  const [dep] = await db
    .insert(deploymentsTable)
    .values({
      userId,
      dropPercent: dropPercent.toString(),
      deployedAmount: totalAmount.toString(),
      allocations: richAllocations as unknown as string,
      note: note ?? null,
      deployedAt: new Date(deployedAt),
    })
    .returning();

  // Create one invest transaction per allocation and debit source account
  if (sourceAccountId) {
    for (const alloc of allocations) {
      await db.insert(transactionsTable).values({
        userId,
        type: "invest",
        amount: alloc.amount.toString(),
        assetId: alloc.assetId ?? null,
        sourceAccountId,
        destinationAccountId: null,
        date: deployedAt,
        tag: null,
        note: note ?? `Opportunity deploy — ${dropPercent}% drop`,
      });
    }
    await db
      .update(accountsTable)
      .set({
        balance: sql`${accountsTable.balance} - ${totalAmount.toString()}`,
      })
      .where(
        and(
          eq(accountsTable.id, sourceAccountId),
          eq(accountsTable.userId, userId),
        ),
      );
  }

  res.status(201).json({
    id: dep.id,
    dropPercent: Number(dep.dropPercent),
    deployedAmount: Number(dep.deployedAmount),
    allocations: richAllocations,
    note: dep.note,
    deployedAt: dep.deployedAt.toISOString(),
  });
});

export default router;

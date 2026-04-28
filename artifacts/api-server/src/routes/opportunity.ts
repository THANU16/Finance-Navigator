import { Router } from "express";
import { db, accountsTable, deploymentsTable, settingsTable, assetsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import {
  getLatestAccountValuationsMap,
  sumEffectiveBalances,
} from "../lib/account-balances";
import { RecordDeploymentBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const accounts = await db.select().from(accountsTable).where(and(eq(accountsTable.userId, userId), eq(accountsTable.tag, "opportunity"), eq(accountsTable.isActive, true)));
  const latestMap = await getLatestAccountValuationsMap(accounts.map((a) => a.id));
  const availableAmount = sumEffectiveBalances(accounts, latestMap);

  const deployments = await db.select().from(deploymentsTable).where(eq(deploymentsTable.userId, userId));
  const totalDeployed = deployments.reduce((s, d) => s + Number(d.deployedAmount), 0);

  const [settings] = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId)).limit(1);
  const dropLevels = settings ? (settings.crashDropLevels as number[]) : [10, 15, 20, 25];
  const strategy = settings ? (settings.crashDeploymentStrategy as Record<string, number>) : { "10": 25, "15": 50, "20": 75, "25": 100 };

  const stages = dropLevels.map(level => {
    const deployPct = strategy[level.toString()] || 0;
    const deployAmount = (availableAmount * deployPct) / 100;
    const triggered = deployments.some(d => Number(d.dropPercent) === level);
    const trigDeploy = deployments.find(d => Number(d.dropPercent) === level);
    return {
      dropPercent: level,
      deployPercent: deployPct,
      deployAmount,
      triggered,
      triggeredAt: triggered && trigDeploy ? trigDeploy.deployedAt.toISOString() : null,
    };
  });

  res.json({ availableAmount, totalDeployed, stages });
});

router.get("/deployments", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const deps = await db.select().from(deploymentsTable).where(eq(deploymentsTable.userId, userId)).orderBy(desc(deploymentsTable.deployedAt));

  const assets = await db.select().from(assetsTable).where(eq(assetsTable.userId, userId));
  const assetMap = new Map(assets.map(a => [a.id, a.name]));

  res.json(deps.map(d => ({
    id: d.id,
    dropPercent: Number(d.dropPercent),
    deployedAmount: Number(d.deployedAmount),
    assetId: d.assetId,
    assetName: d.assetId ? (assetMap.get(d.assetId) ?? null) : null,
    note: d.note,
    deployedAt: d.deployedAt.toISOString(),
  })));
});

router.post("/deployments", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const parsed = RecordDeploymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const { dropPercent, deployedAmount, assetId, note, deployedAt } = parsed.data;
  const [dep] = await db.insert(deploymentsTable).values({
    userId,
    dropPercent: dropPercent.toString(),
    deployedAmount: deployedAmount.toString(),
    assetId: assetId ?? null,
    note: note ?? null,
    deployedAt: new Date(deployedAt),
  }).returning();

  let assetName: string | null = null;
  if (dep.assetId) {
    const [a] = await db.select().from(assetsTable).where(eq(assetsTable.id, dep.assetId)).limit(1);
    assetName = a?.name ?? null;
  }

  res.status(201).json({
    id: dep.id,
    dropPercent: Number(dep.dropPercent),
    deployedAmount: Number(dep.deployedAmount),
    assetId: dep.assetId,
    assetName,
    note: dep.note,
    deployedAt: dep.deployedAt.toISOString(),
  });
});

export default router;

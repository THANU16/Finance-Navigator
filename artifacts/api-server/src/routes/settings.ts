import { Router } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { UpdateSettingsBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

function formatSettings(s: typeof settingsTable.$inferSelect) {
  return {
    id: s.id,
    emergencyFundRequired: Number(s.emergencyFundRequired),
    emergencyFundLowThreshold: Number(s.emergencyFundLowThreshold),
    emergencyFundCriticalThreshold: Number(s.emergencyFundCriticalThreshold),
    rebalancingDriftTolerance: Number(s.rebalancingDriftTolerance),
    crashDropLevels: (s.crashDropLevels as number[]) || [10, 15, 20, 25],
    crashDeploymentStrategy: (s.crashDeploymentStrategy as Record<string, number>) || { "10": 25, "15": 50, "20": 75, "25": 100 },
    currency: s.currency,
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  let [settings] = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId)).limit(1);
  if (!settings) {
    const [newSettings] = await db.insert(settingsTable).values({ userId }).returning();
    settings = newSettings;
  }
  res.json(formatSettings(settings));
});

router.put("/", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const updates: Record<string, unknown> = {};
  if (parsed.data.emergencyFundRequired !== undefined) updates.emergencyFundRequired = parsed.data.emergencyFundRequired.toString();
  if (parsed.data.emergencyFundLowThreshold !== undefined) updates.emergencyFundLowThreshold = parsed.data.emergencyFundLowThreshold.toString();
  if (parsed.data.emergencyFundCriticalThreshold !== undefined) updates.emergencyFundCriticalThreshold = parsed.data.emergencyFundCriticalThreshold.toString();
  if (parsed.data.rebalancingDriftTolerance !== undefined) updates.rebalancingDriftTolerance = parsed.data.rebalancingDriftTolerance.toString();
  if (parsed.data.crashDropLevels !== undefined) updates.crashDropLevels = parsed.data.crashDropLevels;
  if (parsed.data.crashDeploymentStrategy !== undefined) updates.crashDeploymentStrategy = parsed.data.crashDeploymentStrategy;
  if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency;

  let [settings] = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId)).limit(1);
  if (!settings) {
    const [newSettings] = await db.insert(settingsTable).values({ userId }).returning();
    settings = newSettings;
  }

  const [updated] = await db.update(settingsTable).set(updates).where(eq(settingsTable.userId, userId)).returning();
  res.json(formatSettings(updated));
});

export default router;

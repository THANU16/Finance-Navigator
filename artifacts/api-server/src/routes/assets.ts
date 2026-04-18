import { Router } from "express";
import { db, assetsTable, valuationsTable, transactionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { CreateAssetBody, UpdateAssetBody, AddAssetValuationBody } from "@workspace/api-zod";
import { getPortfolioMetrics, getSingleAssetMetrics } from "../lib/portfolio";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const categoryFilter = req.query.category as string | undefined;

  // Use portfolio service for accurate invested + current values
  const portfolio = await getPortfolioMetrics(userId);
  let assets = portfolio.assets;
  if (categoryFilter) {
    assets = assets.filter((a) => a.category === categoryFilter);
  }

  const totalCurrentValue = assets.reduce((s, a) => s + a.currentValue, 0);

  // Also fetch raw asset rows for metadata (targetPercent, currency etc already in AssetMetrics)
  // Fetch isActive status and extra fields not in portfolio metrics
  const rawAssets = await db.select().from(assetsTable).where(eq(assetsTable.userId, userId));
  const rawMap = new Map(rawAssets.map((a) => [a.id, a]));

  res.json(
    assets.map((a) => {
      const raw = rawMap.get(a.assetId);
      return {
        id: a.assetId,
        name: a.assetName,
        category: a.category,
        subCategory: a.subCategory,
        currentValue: a.currentValue,
        investedValue: a.investedAmount,
        units: raw?.units != null ? Number(raw.units) : null,
        nav: raw?.nav != null ? Number(raw.nav) : null,
        pricePerUnit: raw?.pricePerUnit != null ? Number(raw.pricePerUnit) : null,
        profitLoss: a.returnAmount,
        profitLossPercent: a.returnPercent,
        targetPercent: a.targetPercent,
        actualPercent: totalCurrentValue > 0 ? (a.currentValue / totalCurrentValue) * 100 : 0,
        currency: a.currency,
        isActive: a.isActive,
        createdAt: raw?.createdAt.toISOString() ?? "",
        updatedAt: raw?.updatedAt.toISOString() ?? "",
      };
    })
  );
});

router.post("/", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const parsed = CreateAssetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { name, category, subCategory, units, nav, pricePerUnit, targetPercent, currency } = parsed.data;
  const [asset] = await db
    .insert(assetsTable)
    .values({
      userId,
      name,
      category,
      subCategory: subCategory ?? null,
      units: units != null ? units.toString() : null,
      nav: nav != null ? nav.toString() : null,
      pricePerUnit: pricePerUnit != null ? pricePerUnit.toString() : null,
      investedValue: "0",
      targetPercent: targetPercent.toString(),
      currency: currency || "LKR",
    })
    .returning();

  res.status(201).json({
    id: asset.id,
    name: asset.name,
    category: asset.category,
    subCategory: asset.subCategory,
    currentValue: 0,
    investedValue: 0,
    units: asset.units != null ? Number(asset.units) : null,
    nav: asset.nav != null ? Number(asset.nav) : null,
    pricePerUnit: asset.pricePerUnit != null ? Number(asset.pricePerUnit) : null,
    profitLoss: 0,
    profitLossPercent: 0,
    targetPercent: Number(asset.targetPercent),
    actualPercent: 0,
    currency: asset.currency,
    isActive: asset.isActive,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  });
});

router.get("/:id", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [asset] = await db
    .select()
    .from(assetsTable)
    .where(and(eq(assetsTable.id, id), eq(assetsTable.userId, userId)))
    .limit(1);
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  const [metrics, valuations, txs] = await Promise.all([
    getSingleAssetMetrics(id, userId),
    db.select().from(valuationsTable).where(eq(valuationsTable.assetId, id)).orderBy(desc(valuationsTable.date)),
    db.select().from(transactionsTable).where(and(eq(transactionsTable.assetId, id), eq(transactionsTable.userId, userId))).orderBy(desc(transactionsTable.date)),
  ]);

  const formattedVal = valuations.map((v) => ({
    id: v.id,
    assetId: v.assetId,
    value: Number(v.value),
    units: v.units != null ? Number(v.units) : null,
    nav: v.nav != null ? Number(v.nav) : null,
    pricePerUnit: v.pricePerUnit != null ? Number(v.pricePerUnit) : null,
    date: v.date,
    note: v.note,
    createdAt: v.createdAt.toISOString(),
  }));

  const formattedTxs = txs.map((t) => ({
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    assetId: t.assetId,
    assetName: asset.name,
    sourceAccountId: t.sourceAccountId,
    destinationAccountId: t.destinationAccountId,
    date: t.date,
    tag: t.tag,
    note: t.note,
    createdAt: t.createdAt.toISOString(),
  }));

  const currentValue = metrics?.currentValue ?? 0;
  const investedValue = metrics?.investedAmount ?? 0;

  res.json({
    id: asset.id,
    name: asset.name,
    category: asset.category,
    subCategory: asset.subCategory,
    currentValue,
    investedValue,
    units: asset.units != null ? Number(asset.units) : null,
    nav: asset.nav != null ? Number(asset.nav) : null,
    pricePerUnit: asset.pricePerUnit != null ? Number(asset.pricePerUnit) : null,
    profitLoss: metrics?.returnAmount ?? 0,
    profitLossPercent: metrics?.returnPercent ?? 0,
    targetPercent: Number(asset.targetPercent),
    actualPercent: 0,
    currency: asset.currency,
    isActive: asset.isActive,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    valuations: formattedVal,
    transactions: formattedTxs,
  });
});

router.patch("/:id", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = UpdateAssetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.units !== undefined) updates.units = parsed.data.units != null ? parsed.data.units.toString() : null;
  if (parsed.data.nav !== undefined) updates.nav = parsed.data.nav != null ? parsed.data.nav.toString() : null;
  if (parsed.data.pricePerUnit !== undefined) updates.pricePerUnit = parsed.data.pricePerUnit != null ? parsed.data.pricePerUnit.toString() : null;
  if (parsed.data.targetPercent !== undefined) updates.targetPercent = parsed.data.targetPercent.toString();
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  const [asset] = await db
    .update(assetsTable)
    .set(updates)
    .where(and(eq(assetsTable.id, id), eq(assetsTable.userId, userId)))
    .returning();
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  const metrics = await getSingleAssetMetrics(id, userId);
  res.json({
    id: asset.id,
    name: asset.name,
    category: asset.category,
    subCategory: asset.subCategory,
    currentValue: metrics?.currentValue ?? 0,
    investedValue: metrics?.investedAmount ?? 0,
    units: asset.units != null ? Number(asset.units) : null,
    nav: asset.nav != null ? Number(asset.nav) : null,
    pricePerUnit: asset.pricePerUnit != null ? Number(asset.pricePerUnit) : null,
    profitLoss: metrics?.returnAmount ?? 0,
    profitLossPercent: metrics?.returnPercent ?? 0,
    targetPercent: Number(asset.targetPercent),
    actualPercent: 0,
    currency: asset.currency,
    isActive: asset.isActive,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  });
});

router.delete("/:id", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [deleted] = await db
    .delete(assetsTable)
    .where(and(eq(assetsTable.id, id), eq(assetsTable.userId, userId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  res.json({ message: "Asset deleted" });
});

// Valuations
router.get("/:id/valuations", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [asset] = await db.select().from(assetsTable).where(and(eq(assetsTable.id, id), eq(assetsTable.userId, userId))).limit(1);
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  const vals = await db.select().from(valuationsTable).where(eq(valuationsTable.assetId, id)).orderBy(desc(valuationsTable.date));
  res.json(
    vals.map((v) => ({
      id: v.id,
      assetId: v.assetId,
      value: Number(v.value),
      units: v.units != null ? Number(v.units) : null,
      nav: v.nav != null ? Number(v.nav) : null,
      pricePerUnit: v.pricePerUnit != null ? Number(v.pricePerUnit) : null,
      date: v.date,
      note: v.note,
      createdAt: v.createdAt.toISOString(),
    }))
  );
});

router.post("/:id/valuations", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [asset] = await db.select().from(assetsTable).where(and(eq(assetsTable.id, id), eq(assetsTable.userId, userId))).limit(1);
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  const parsed = AddAssetValuationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { value, units, nav, pricePerUnit, date, note } = parsed.data;
  const [val] = await db
    .insert(valuationsTable)
    .values({
      assetId: id,
      value: value.toString(),
      units: units != null ? units.toString() : null,
      nav: nav != null ? nav.toString() : null,
      pricePerUnit: pricePerUnit != null ? pricePerUnit.toString() : null,
      date,
      note: note ?? null,
    })
    .returning();

  // Keep asset metadata columns (units/nav/pricePerUnit) in sync with latest valuation
  // for display purposes. currentValue is always derived from latest valuation.
  if (units != null) {
    const assetUpdates: Record<string, unknown> = { units: units.toString() };
    if (nav != null) assetUpdates.nav = nav.toString();
    if (pricePerUnit != null) assetUpdates.pricePerUnit = pricePerUnit.toString();
    await db.update(assetsTable).set(assetUpdates).where(eq(assetsTable.id, id));
  }

  res.status(201).json({
    id: val.id,
    assetId: val.assetId,
    value: Number(val.value),
    units: val.units != null ? Number(val.units) : null,
    nav: val.nav != null ? Number(val.nav) : null,
    pricePerUnit: val.pricePerUnit != null ? Number(val.pricePerUnit) : null,
    date: val.date,
    note: val.note,
    createdAt: val.createdAt.toISOString(),
  });
});

router.patch("/:id/valuations/:valuationId", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  const valuationId = parseInt(Array.isArray(req.params.valuationId) ? req.params.valuationId[0] : req.params.valuationId);
  if (isNaN(id) || isNaN(valuationId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [asset] = await db.select().from(assetsTable).where(and(eq(assetsTable.id, id), eq(assetsTable.userId, userId))).limit(1);
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  const parsed = AddAssetValuationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { value, units, nav, pricePerUnit, date, note } = parsed.data;
  const [val] = await db
    .update(valuationsTable)
    .set({
      value: value.toString(),
      units: units != null ? units.toString() : null,
      nav: nav != null ? nav.toString() : null,
      pricePerUnit: pricePerUnit != null ? pricePerUnit.toString() : null,
      date,
      note: note ?? null,
    })
    .where(eq(valuationsTable.id, valuationId))
    .returning();

  if (!val) {
    res.status(404).json({ error: "Valuation not found" });
    return;
  }

  res.json({
    id: val.id,
    assetId: val.assetId,
    value: Number(val.value),
    units: val.units != null ? Number(val.units) : null,
    nav: val.nav != null ? Number(val.nav) : null,
    pricePerUnit: val.pricePerUnit != null ? Number(val.pricePerUnit) : null,
    date: val.date,
    note: val.note,
    createdAt: val.createdAt.toISOString(),
  });
});

router.delete("/:id/valuations/:valuationId", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params.id as string);
  const valuationId = parseInt(Array.isArray(req.params.valuationId) ? req.params.valuationId[0] : req.params.valuationId);
  if (isNaN(id) || isNaN(valuationId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [asset] = await db.select().from(assetsTable).where(and(eq(assetsTable.id, id), eq(assetsTable.userId, userId))).limit(1);
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  const [deleted] = await db.delete(valuationsTable).where(eq(valuationsTable.id, valuationId)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Valuation not found" });
    return;
  }

  res.json({ message: "Valuation deleted" });
});

export default router;

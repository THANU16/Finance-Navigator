import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { assetsTable } from "./assets";

export const valuationsTable = pgTable("valuations", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull().references(() => assetsTable.id, { onDelete: "cascade" }),
  value: numeric("value", { precision: 18, scale: 2 }).notNull(),
  units: numeric("units", { precision: 18, scale: 6 }),
  nav: numeric("nav", { precision: 18, scale: 6 }),
  pricePerUnit: numeric("price_per_unit", { precision: 18, scale: 6 }),
  date: text("date").notNull(), // ISO date string YYYY-MM-DD
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertValuationSchema = createInsertSchema(valuationsTable).omit({ id: true, createdAt: true });
export type InsertValuation = z.infer<typeof insertValuationSchema>;
export type Valuation = typeof valuationsTable.$inferSelect;

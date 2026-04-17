import { pgTable, text, serial, timestamp, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const sipConfigsTable = pgTable("sip_configs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }).unique(),
  monthlyAmount: numeric("monthly_amount", { precision: 18, scale: 2 }).notNull().default("0"),
  equityPercent: numeric("equity_percent", { precision: 5, scale: 2 }).notNull().default("60"),
  debtPercent: numeric("debt_percent", { precision: 5, scale: 2 }).notNull().default("20"),
  metalsPercent: numeric("metals_percent", { precision: 5, scale: 2 }).notNull().default("10"),
  opportunityPercent: numeric("opportunity_percent", { precision: 5, scale: 2 }).notNull().default("10"),
  assetAllocations: jsonb("asset_allocations").notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSipConfigSchema = createInsertSchema(sipConfigsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSipConfig = z.infer<typeof insertSipConfigSchema>;
export type SipConfig = typeof sipConfigsTable.$inferSelect;

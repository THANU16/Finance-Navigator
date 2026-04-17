import { pgTable, serial, timestamp, integer, numeric, jsonb, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }).unique(),
  emergencyFundRequired: numeric("emergency_fund_required", { precision: 18, scale: 2 }).notNull().default("0"),
  emergencyFundLowThreshold: numeric("emergency_fund_low_threshold", { precision: 5, scale: 2 }).notNull().default("80"),
  emergencyFundCriticalThreshold: numeric("emergency_fund_critical_threshold", { precision: 5, scale: 2 }).notNull().default("50"),
  rebalancingDriftTolerance: numeric("rebalancing_drift_tolerance", { precision: 5, scale: 2 }).notNull().default("5"),
  crashDropLevels: jsonb("crash_drop_levels").notNull().default([10, 15, 20, 25]),
  crashDeploymentStrategy: jsonb("crash_deployment_strategy").notNull().default({ "10": 25, "15": 50, "20": 75, "25": 100 }),
  currency: text("currency").notNull().default("LKR"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;

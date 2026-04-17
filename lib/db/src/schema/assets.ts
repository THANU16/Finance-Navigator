import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const assetsTable = pgTable("assets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(), // equity_fund, debt_fund, metal, cash
  subCategory: text("sub_category"),
  units: numeric("units", { precision: 18, scale: 6 }),
  nav: numeric("nav", { precision: 18, scale: 6 }),
  pricePerUnit: numeric("price_per_unit", { precision: 18, scale: 6 }),
  investedValue: numeric("invested_value", { precision: 18, scale: 2 }).notNull().default("0"),
  targetPercent: numeric("target_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("LKR"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAssetSchema = createInsertSchema(assetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assetsTable.$inferSelect;

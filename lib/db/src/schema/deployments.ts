import { pgTable, serial, timestamp, integer, numeric, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const deploymentsTable = pgTable("deployments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  dropPercent: numeric("drop_percent", { precision: 5, scale: 2 }).notNull(),
  deployedAmount: numeric("deployed_amount", { precision: 18, scale: 2 }).notNull(),
  assetId: integer("asset_id"),
  note: text("note"),
  deployedAt: timestamp("deployed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDeploymentSchema = createInsertSchema(deploymentsTable).omit({ id: true, createdAt: true });
export type InsertDeployment = z.infer<typeof insertDeploymentSchema>;
export type Deployment = typeof deploymentsTable.$inferSelect;

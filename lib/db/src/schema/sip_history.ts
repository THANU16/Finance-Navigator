import { pgTable, serial, timestamp, integer, numeric, jsonb, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const sipHistoryTable = pgTable("sip_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  month: text("month").notNull(), // YYYY-MM
  totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).notNull(),
  breakdown: jsonb("breakdown").notNull().default([]),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSipHistorySchema = createInsertSchema(sipHistoryTable).omit({ id: true, createdAt: true });
export type InsertSipHistory = z.infer<typeof insertSipHistorySchema>;
export type SipHistory = typeof sipHistoryTable.$inferSelect;

import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { accountsTable } from "./accounts";

export const accountValuationsTable = pgTable("account_valuations", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  value: numeric("value", { precision: 18, scale: 2 }).notNull(),
  date: text("date").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAccountValuationSchema = createInsertSchema(accountValuationsTable).omit({ id: true, createdAt: true });
export type InsertAccountValuation = z.infer<typeof insertAccountValuationSchema>;
export type AccountValuation = typeof accountValuationsTable.$inferSelect;

import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // bank, money_market, cash
  subCategory: text("sub_category"), // savings, investment, current (for bank type)
  tag: text("tag").notNull(), // emergency, opportunity, free
  // Principal = the amount the user originally deposited (snapshot).
  // Set on account create / explicit edit; NEVER mutated by transactions.
  // Used as "principal" in interest calculations: interest = current - principal.
  principal: numeric("principal", { precision: 18, scale: 2 }).notNull().default("0"),
  // Balance = running ledger after transactions (deposit/withdrawal/invest/etc.).
  // May go negative if outflows exceed inflows. Not used for display purposes.
  balance: numeric("balance", { precision: 18, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("LKR"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAccountSchema = createInsertSchema(accountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;

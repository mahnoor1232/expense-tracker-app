import { integer, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const budgets = pgTable('budgets', {
  id: integer('id').primaryKey().default(1),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull().default('2000.00'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const expenses = pgTable('expenses', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  title: text('title').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  category: text('category').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Expense = typeof expenses.$inferSelect

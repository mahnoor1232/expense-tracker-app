import { integer, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const expenses = pgTable('expenses', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  title: text('title').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  category: text('category').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Expense = typeof expenses.$inferSelect

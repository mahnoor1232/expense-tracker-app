import { integer, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const budgets = pgTable('budgets', { id: integer('id').primaryKey().default(1), amount: numeric('amount', { precision: 10, scale: 2 }).notNull().default('2000.00'), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow() })
export const categoryBudgets = pgTable('category_budgets', { id: integer('id').primaryKey().generatedAlwaysAsIdentity(), category: text('category').notNull().unique(), amount: numeric('amount', { precision: 10, scale: 2 }).notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow() })
export const preferences = pgTable('preferences', { id: integer('id').primaryKey().default(1), currency: text('currency').notNull().default('USD'), dateFormat: text('date_format').notNull().default('en-US'), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow() })
export const expenses = pgTable('expenses', { id: integer('id').primaryKey().generatedAlwaysAsIdentity(), title: text('title').notNull(), amount: numeric('amount', { precision: 10, scale: 2 }).notNull(), category: text('category').notNull(), transactionType: text('transaction_type').notNull().default('expense'), transactionDate: timestamp('transaction_date', { withTimezone: true }).notNull().defaultNow(), notes: text('notes'), paymentMethod: text('payment_method'), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow() })
export type Expense = typeof expenses.$inferSelect
export type CategoryBudget = typeof categoryBudgets.$inferSelect
export type Preference = typeof preferences.$inferSelect

export const defaultCategories = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Other']


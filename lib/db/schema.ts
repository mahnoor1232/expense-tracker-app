import { boolean, date, index, integer, numeric, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull(),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull(),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

export const budgets = pgTable('budgets', { id: integer('id').primaryKey().default(1), amount: numeric('amount', { precision: 10, scale: 2 }).notNull().default('2000.00'), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow() })
export const categoryBudgets = pgTable('category_budgets', { id: integer('id').primaryKey().generatedAlwaysAsIdentity(), category: text('category').notNull().unique(), amount: numeric('amount', { precision: 10, scale: 2 }).notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow() })
export const preferences = pgTable('preferences', { id: integer('id').primaryKey().default(1), currency: text('currency').notNull().default('USD'), dateFormat: text('date_format').notNull().default('en-US'), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow() })

export const expenses = pgTable('expenses', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: text('user_id'),
  title: text('title').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  category: text('category').notNull(),
  transactionType: text('transaction_type').notNull().default('expense'),
  transactionDate: timestamp('transaction_date', { withTimezone: true }).notNull().defaultNow(),
  notes: text('notes'),
  paymentMethod: text('payment_method'),
  tags: text('tags').array().notNull().default([]),
  receiptPath: text('receipt_url'),
  accountId: integer('account_id'),
  recurringId: integer('recurring_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('expenses_user_date_idx').on(table.userId, table.transactionDate)])

export const userBudgets = pgTable('user_budgets', {
  userId: text('user_id').primaryKey(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull().default('2000.00'),
  rollover: boolean('rollover').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
export const financeCategories = pgTable('finance_categories', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(), userId: text('user_id').notNull(),
  name: text('name').notNull(), icon: text('icon').notNull().default('Circle'), color: text('color').notNull().default('#6f9879'),
  isDefault: boolean('is_default').notNull().default(false), defaultKey: text('default_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique('finance_categories_user_name_idx').on(table.userId, table.name)])
export const userCategoryBudgets = pgTable('user_category_budgets', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(), userId: text('user_id').notNull(), category: text('category').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(), rollover: boolean('rollover').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique('user_category_budgets_user_category_idx').on(table.userId, table.category)])
export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id').primaryKey(), currency: text('currency').notNull().default('USD'),
  dateFormat: text('date_format').notNull().default('en-US'), theme: text('theme').notNull().default('system'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
export const financeAccounts = pgTable('finance_accounts', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(), userId: text('user_id').notNull(), name: text('name').notNull(),
  kind: text('kind').notNull().default('cash'), currency: text('currency').notNull().default('USD'),
  openingBalance: numeric('opening_balance', { precision: 12, scale: 2 }).notNull().default('0'),
  archived: boolean('archived').notNull().default(false), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique('finance_accounts_user_name_idx').on(table.userId, table.name)])
export const financeTransfers = pgTable('finance_transfers', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(), userId: text('user_id').notNull(),
  fromAccountId: integer('from_account_id').notNull(), toAccountId: integer('to_account_id').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(), transferDate: date('transfer_date').notNull(),
  note: text('note'), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export const savingsGoals = pgTable('savings_goals', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(), userId: text('user_id').notNull(), name: text('name').notNull(),
  targetAmount: numeric('target_amount', { precision: 12, scale: 2 }).notNull(), savedAmount: numeric('saved_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  deadline: date('deadline'), color: text('color').notNull().default('#6f9879'), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export const recurringTransactions = pgTable('recurring_transactions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(), userId: text('user_id').notNull(), title: text('title').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(), category: text('category').notNull(), transactionType: text('transaction_type').notNull().default('expense'),
  paymentMethod: text('payment_method'), accountId: integer('account_id'), frequency: text('frequency').notNull(),
  startsOn: date('starts_on').notNull(), endsOn: date('ends_on'), nextDue: date('next_due').notNull(),
  enabled: boolean('enabled').notNull().default(true), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Expense = typeof expenses.$inferSelect
export type CategoryBudget = typeof categoryBudgets.$inferSelect
export type Preference = typeof preferences.$inferSelect
export type FinanceAccount = typeof financeAccounts.$inferSelect
export type SavingsGoal = typeof savingsGoals.$inferSelect
export const defaultCategories = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Other'] as const

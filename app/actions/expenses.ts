'use server'

import { del, list } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { defaultCategories, expenses, financeAccounts, financeCategories, financeTransfers, recurringTransactions, savingsGoals, userBudgets, userCategoryBudgets, userPreferences } from '@/lib/db/schema'
import { and, asc, count, desc, eq, gte, ilike, lte, or } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

const currencies = ['USD', 'PKR', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'NZD', 'CHF'] as const
const transactionTypes = ['expense', 'income'] as const
const frequencies = ['daily', 'weekly', 'monthly', 'yearly'] as const
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const revalidateFinance = () => ['/','/transactions','/insights','/budgets','/settings','/reports'].forEach((path) => revalidatePath(path))

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

function text(value: unknown, label: string, max = 120) {
  const result = String(value ?? '').trim()
  if (!result || result.length > max) throw new Error(`${label} is required and must be ${max} characters or fewer`)
  return result
}
function amount(value: unknown, label = 'Amount', allowZero = false) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || (!allowZero && n === 0) || n > 100_000_000) throw new Error(`${label} must be ${allowZero ? 'zero or greater' : 'greater than zero'}`)
  return n.toFixed(2)
}
function validDate(value: string) {
  if (!datePattern.test(value)) throw new Error('Enter a valid date')
  const parsed = new Date(`${value}T12:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Enter a valid date')
  return parsed
}
function dateOnly(date: Date) { return date.toISOString().slice(0, 10) }
function advanceDate(value: string, frequency: string) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  if (frequency === 'daily') date.setUTCDate(date.getUTCDate() + 1)
  if (frequency === 'weekly') date.setUTCDate(date.getUTCDate() + 7)
  if (frequency === 'monthly') { const targetDay = date.getUTCDate(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + 1); const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate(); date.setUTCDate(Math.min(targetDay, last)) }
  if (frequency === 'yearly') { const targetMonth = date.getUTCMonth(); date.setUTCDate(1); date.setUTCFullYear(date.getUTCFullYear() + 1); date.setUTCMonth(targetMonth); const last = new Date(Date.UTC(date.getUTCFullYear(), targetMonth + 1, 0)).getUTCDate(); date.setUTCDate(Math.min(day, last)) }
  return dateOnly(date)
}
async function ensureUserDefaults(userId: string) {
  await db.insert(financeCategories).values(defaultCategories.map((name) => ({ userId, name, defaultKey: name.toLowerCase(), isDefault: true }))).onConflictDoNothing()
  let [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1)
  if (!prefs) {
    await db.insert(userPreferences).values({ userId }).onConflictDoNothing()
    ;[prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1)
  }
  const [budget] = await db.select().from(userBudgets).where(eq(userBudgets.userId, userId)).limit(1)
  if (!budget) await db.insert(userBudgets).values({ userId }).onConflictDoNothing()
  const [firstAccount] = await db.select({ id: financeAccounts.id }).from(financeAccounts).where(eq(financeAccounts.userId, userId)).limit(1)
  if (!firstAccount) await db.insert(financeAccounts).values([
    { userId, name: 'Cash', kind: 'cash', currency: prefs?.currency ?? 'USD' },
    { userId, name: 'Bank', kind: 'bank', currency: prefs?.currency ?? 'USD' },
    { userId, name: 'Card', kind: 'card', currency: prefs?.currency ?? 'USD' },
  ]).onConflictDoNothing()
}
async function assertAccount(userId: string, accountId: number | null | undefined) {
  if (accountId == null) return
  if (!Number.isInteger(accountId) || accountId <= 0) throw new Error('Choose a valid account')
  const [found] = await db.select({ id: financeAccounts.id }).from(financeAccounts).where(and(eq(financeAccounts.id, accountId), eq(financeAccounts.userId, userId))).limit(1)
  if (!found) throw new Error('Account not found')
}

export async function getLedgerData() {
  const userId = await getUserId()
  await ensureUserDefaults(userId)
  const today = dateOnly(new Date())
  const due = await db.select().from(recurringTransactions).where(and(eq(recurringTransactions.userId, userId), eq(recurringTransactions.enabled, true), lte(recurringTransactions.nextDue, today))).limit(100)
  if (due.length) {
    await db.transaction(async (tx) => {
      for (const schedule of due) {
        let occurrence = schedule.nextDue
        let generated = 0
        while (occurrence <= today && generated < 500 && (!schedule.endsOn || occurrence <= schedule.endsOn)) {
          await tx.insert(expenses).values({ userId, title: schedule.title, amount: schedule.amount, category: schedule.category, transactionType: schedule.transactionType, transactionDate: validDate(occurrence), paymentMethod: schedule.paymentMethod, accountId: schedule.accountId, recurringId: schedule.id }).onConflictDoNothing()
          occurrence = advanceDate(occurrence, schedule.frequency)
          generated++
        }
        await tx.update(recurringTransactions).set({ nextDue: occurrence, ...(schedule.endsOn && occurrence > schedule.endsOn ? { enabled: false } : {}) }).where(and(eq(recurringTransactions.id, schedule.id), eq(recurringTransactions.userId, userId)))
      }
    })
  }
  const [transactionRows, [budget], categoryBudgets, [prefs], categories, accountRows, transferRows, goals, schedules] = await Promise.all([
    db.select().from(expenses).where(eq(expenses.userId, userId)).orderBy(desc(expenses.transactionDate), desc(expenses.createdAt)).limit(5000),
    db.select().from(userBudgets).where(eq(userBudgets.userId, userId)).limit(1),
    db.select().from(userCategoryBudgets).where(eq(userCategoryBudgets.userId, userId)).orderBy(asc(userCategoryBudgets.category)),
    db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1),
    db.select().from(financeCategories).where(eq(financeCategories.userId, userId)).orderBy(asc(financeCategories.name)),
    db.select().from(financeAccounts).where(and(eq(financeAccounts.userId, userId), eq(financeAccounts.archived, false))).orderBy(asc(financeAccounts.name)),
    db.select().from(financeTransfers).where(eq(financeTransfers.userId, userId)).orderBy(desc(financeTransfers.transferDate)).limit(5000),
    db.select().from(savingsGoals).where(eq(savingsGoals.userId, userId)).orderBy(asc(savingsGoals.deadline)),
    db.select().from(recurringTransactions).where(and(eq(recurringTransactions.userId, userId), eq(recurringTransactions.enabled, true))).orderBy(asc(recurringTransactions.nextDue)),
  ])
  const accounts = accountRows.map((account) => {
    const income = transactionRows.filter((row) => row.accountId === account.id && row.transactionType === 'income').reduce((sum, row) => sum + Number(row.amount), 0)
    const spent = transactionRows.filter((row) => row.accountId === account.id && row.transactionType === 'expense').reduce((sum, row) => sum + Number(row.amount), 0)
    const incoming = transferRows.filter((row) => row.toAccountId === account.id).reduce((sum, row) => sum + Number(row.amount), 0)
    const outgoing = transferRows.filter((row) => row.fromAccountId === account.id).reduce((sum, row) => sum + Number(row.amount), 0)
    return { ...account, balance: Number(account.openingBalance) + income - spent + incoming - outgoing }
  })
  return { expenses: transactionRows, budget: budget ?? { amount: '2000.00', rollover: false }, categoryBudgets, preferences: prefs ?? { currency: 'USD', dateFormat: 'en-US', theme: 'system' }, categories, accounts, transfers: transferRows, goals, schedules }
}

export type TransactionQuery = { page?: number; pageSize?: number; query?: string; category?: string; paymentMethod?: string; type?: string; startDate?: string; endDate?: string; sort?: 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' }
export async function searchTransactions(filters: TransactionQuery = {}) {
  const userId = await getUserId()
  const page = Math.max(1, Math.floor(filters.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(filters.pageSize ?? 20)))
  const conditions = [eq(expenses.userId, userId)]
  if (filters.query?.trim()) conditions.push(or(ilike(expenses.title, `%${filters.query.trim().slice(0, 100)}%`), ilike(expenses.notes, `%${filters.query.trim().slice(0, 100)}%`)) as typeof conditions[number])
  if (filters.category && filters.category !== 'all') conditions.push(eq(expenses.category, filters.category))
  if (filters.paymentMethod && filters.paymentMethod !== 'all') conditions.push(eq(expenses.paymentMethod, filters.paymentMethod))
  if (filters.type && filters.type !== 'all') conditions.push(eq(expenses.transactionType, filters.type))
  if (filters.startDate) conditions.push(gte(expenses.transactionDate, validDate(filters.startDate)))
  if (filters.endDate) conditions.push(lte(expenses.transactionDate, validDate(filters.endDate)))
  const where = and(...conditions)
  const order = filters.sort === 'date-asc' ? asc(expenses.transactionDate) : filters.sort === 'amount-desc' ? desc(expenses.amount) : filters.sort === 'amount-asc' ? asc(expenses.amount) : desc(expenses.transactionDate)
  const [rows, [total]] = await Promise.all([
    db.select().from(expenses).where(where).orderBy(order, desc(expenses.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ value: count() }).from(expenses).where(where),
  ])
  return { rows, total: total.value, page, pageSize, pages: Math.max(1, Math.ceil(total.value / pageSize)) }
}

export async function getExpenses() {
  const userId = await getUserId()
  return db.select().from(expenses).where(eq(expenses.userId, userId)).orderBy(desc(expenses.transactionDate), desc(expenses.createdAt)).limit(5000)
}
export async function getBudget() { const userId = await getUserId(); const [row] = await db.select().from(userBudgets).where(eq(userBudgets.userId, userId)).limit(1); return Number(row?.amount ?? 2000) }
export async function updateBudget(value: number, rollover = false) {
  const userId = await getUserId(); const clean = amount(value, 'Budget')
  await db.insert(userBudgets).values({ userId, amount: clean, rollover }).onConflictDoUpdate({ target: userBudgets.userId, set: { amount: clean, rollover, updatedAt: new Date() } })
  revalidateFinance()
}
export async function getCategoryBudgets() { const userId = await getUserId(); return db.select().from(userCategoryBudgets).where(eq(userCategoryBudgets.userId, userId)).orderBy(asc(userCategoryBudgets.category)) }
export async function updateCategoryBudget(category: string, value: number, rollover = false) {
  const userId = await getUserId(); const name = text(category, 'Category', 40); const clean = amount(value, 'Budget')
  await db.insert(userCategoryBudgets).values({ userId, category: name, amount: clean, rollover }).onConflictDoUpdate({ target: [userCategoryBudgets.userId, userCategoryBudgets.category], set: { amount: clean, rollover, updatedAt: new Date() } })
  revalidateFinance()
}
export async function deleteCategoryBudget(id: number) { const userId = await getUserId(); await db.delete(userCategoryBudgets).where(and(eq(userCategoryBudgets.id, id), eq(userCategoryBudgets.userId, userId))); revalidateFinance() }

export async function getPreferences() { const userId = await getUserId(); const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1); return row ?? { currency: 'USD', dateFormat: 'en-US', theme: 'system' } }
export async function updatePreferences(input: { currency: string; dateFormat: string; theme: string }) {
  const userId = await getUserId(); const currency = input.currency.toUpperCase(); const dateFormat = input.dateFormat; const theme = input.theme
  if (!(currencies as readonly string[]).includes(currency)) throw new Error('Choose a supported currency')
  if (!['en-US','en-GB'].includes(dateFormat)) throw new Error('Choose a supported date format')
  if (!['light','dark','system'].includes(theme)) throw new Error('Choose a supported theme')
  await db.transaction(async (tx) => {
    await tx.insert(userPreferences).values({ userId, currency, dateFormat, theme }).onConflictDoUpdate({ target: userPreferences.userId, set: { currency, dateFormat, theme, updatedAt: new Date() } })
    await tx.update(financeAccounts).set({ currency }).where(eq(financeAccounts.userId, userId))
  })
  revalidateFinance()
}

export type TransactionInput = { title: string; amount: number; category: string; transactionType?: string; transactionDate?: string; notes?: string; paymentMethod?: string; tags?: string[]; receiptPath?: string | null; accountId?: number | null }
function cleanTransaction(input: TransactionInput) {
  const title = text(input.title, 'Description'); const category = text(input.category, 'Category', 40)
  const transactionType = input.transactionType ?? 'expense'
  if (!(transactionTypes as readonly string[]).includes(transactionType)) throw new Error('Choose expense or income')
  const tags = [...new Set((input.tags ?? []).map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 10).map((tag) => tag.slice(0, 24))
  const notes = input.notes?.trim().slice(0, 500) || null
  const paymentMethod = input.paymentMethod?.trim().slice(0, 40) || null
  const transactionDate = validDate(input.transactionDate ?? dateOnly(new Date()))
  const receiptPath = input.receiptPath?.trim() || null
  if (receiptPath && (receiptPath.length > 300 || receiptPath.includes('..'))) throw new Error('Invalid receipt attachment')
  return { title, amount: amount(input.amount), category, transactionType, transactionDate, notes, paymentMethod, tags, receiptPath, accountId: input.accountId ?? null }
}
export async function addExpense(input: TransactionInput) {
  const userId = await getUserId(); const cleaned = cleanTransaction(input); await assertAccount(userId, cleaned.accountId)
  if (cleaned.receiptPath && !cleaned.receiptPath.startsWith(`users/${userId}/receipts/`)) throw new Error('Receipt attachment does not belong to this account')
  await db.insert(expenses).values({ ...cleaned, userId }); revalidateFinance()
}
export async function updateExpense(id: number, input: TransactionInput) {
  const userId = await getUserId(); if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid transaction')
  const cleaned = cleanTransaction(input); await assertAccount(userId, cleaned.accountId)
  if (cleaned.receiptPath && !cleaned.receiptPath.startsWith(`users/${userId}/receipts/`)) throw new Error('Receipt attachment does not belong to this account')
  await db.update(expenses).set(cleaned).where(and(eq(expenses.id, id), eq(expenses.userId, userId))); revalidateFinance()
}
export async function deleteExpense(id: number) {
  const userId = await getUserId(); if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid transaction')
  const [row] = await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId))).returning()
  if (!row) throw new Error('Transaction not found')
  revalidateFinance(); return row
}
export async function restoreExpense(row: Omit<Awaited<ReturnType<typeof deleteExpense>>, 'id' | 'createdAt'>) {
  const userId = await getUserId(); await db.insert(expenses).values({ ...row, userId }); revalidateFinance()
}
export async function exportExpenses() { return getExpenses() }

export async function getCategories() { const userId = await getUserId(); await ensureUserDefaults(userId); return db.select().from(financeCategories).where(eq(financeCategories.userId, userId)).orderBy(asc(financeCategories.name)) }
export async function saveCategory(input: { id?: number; name: string; icon?: string; color?: string }) {
  const userId = await getUserId(); const name = text(input.name, 'Category name', 40); const icon = (input.icon || 'Circle').slice(0, 32); const color = /^#[0-9a-fA-F]{6}$/.test(input.color ?? '') ? input.color! : '#6f9879'
  if (input.id) {
    const [existing] = await db.select().from(financeCategories).where(and(eq(financeCategories.id, input.id), eq(financeCategories.userId, userId))).limit(1)
    if (!existing) throw new Error('Category not found')
    await db.transaction(async (tx) => {
      await tx.update(financeCategories).set({ name, icon, color }).where(and(eq(financeCategories.id, input.id!), eq(financeCategories.userId, userId)))
      if (existing.name !== name) {
        await tx.update(expenses).set({ category: name }).where(and(eq(expenses.userId, userId), eq(expenses.category, existing.name)))
        await tx.update(userCategoryBudgets).set({ category: name }).where(and(eq(userCategoryBudgets.userId, userId), eq(userCategoryBudgets.category, existing.name)))
        await tx.update(recurringTransactions).set({ category: name }).where(and(eq(recurringTransactions.userId, userId), eq(recurringTransactions.category, existing.name)))
      }
    })
  } else await db.insert(financeCategories).values({ userId, name, icon, color })
  revalidateFinance()
}
export async function deleteCategory(id: number) {
  const userId = await getUserId(); const [row] = await db.select().from(financeCategories).where(and(eq(financeCategories.id, id), eq(financeCategories.userId, userId))).limit(1)
  if (!row) throw new Error('Category not found')
  if (row.isDefault) throw new Error('Built-in categories can be edited but not removed')
  const [usage] = await db.select({ value: count() }).from(expenses).where(and(eq(expenses.userId, userId), eq(expenses.category, row.name)))
  if (usage.value) throw new Error('This category is used by transactions. Edit it instead so your history stays intact.')
  await db.delete(financeCategories).where(and(eq(financeCategories.id, id), eq(financeCategories.userId, userId))); revalidateFinance()
}

export async function getAccounts() { const data = await getLedgerData(); return data.accounts }
export async function saveAccount(input: { id?: number; name: string; kind: string; currency?: string; openingBalance: number }) {
  const userId = await getUserId(); const name = text(input.name, 'Account name', 60); const kind = ['cash','bank','card','investment','other'].includes(input.kind) ? input.kind : 'other'
  const currency = currencies.includes((input.currency ?? 'USD').toUpperCase() as typeof currencies[number]) ? (input.currency ?? 'USD').toUpperCase() : 'USD'
  const openingBalance = amount(input.openingBalance, 'Opening balance', true)
  if (input.id) await db.update(financeAccounts).set({ name, kind, currency, openingBalance }).where(and(eq(financeAccounts.id, input.id), eq(financeAccounts.userId, userId)))
  else await db.insert(financeAccounts).values({ userId, name, kind, currency, openingBalance })
  revalidateFinance()
}
export async function deleteAccount(id: number) {
  const userId = await getUserId(); const [transactions] = await db.select({ value: count() }).from(expenses).where(and(eq(expenses.userId, userId), eq(expenses.accountId, id)))
  const [transfers] = await db.select({ value: count() }).from(financeTransfers).where(and(eq(financeTransfers.userId, userId), or(eq(financeTransfers.fromAccountId, id), eq(financeTransfers.toAccountId, id))))
  if (transactions.value || transfers.value) throw new Error('This account has activity. Archive it instead of deleting it.')
  await db.delete(financeAccounts).where(and(eq(financeAccounts.id, id), eq(financeAccounts.userId, userId))); revalidateFinance()
}
export async function transferBetweenAccounts(input: { fromAccountId: number; toAccountId: number; amount: number; date: string; note?: string }) {
  const userId = await getUserId(); if (input.fromAccountId === input.toAccountId) throw new Error('Choose two different accounts')
  await assertAccount(userId, input.fromAccountId); await assertAccount(userId, input.toAccountId)
  validDate(input.date)
  await db.insert(financeTransfers).values({ userId, fromAccountId: input.fromAccountId, toAccountId: input.toAccountId, amount: amount(input.amount), transferDate: input.date, note: input.note?.trim().slice(0, 240) || null })
  revalidateFinance()
}

export async function saveGoal(input: { id?: number; name: string; targetAmount: number; savedAmount: number; deadline?: string; color?: string }) {
  const userId = await getUserId(); const name = text(input.name, 'Goal name', 80); const targetAmount = amount(input.targetAmount, 'Target')
  const savedAmount = amount(input.savedAmount, 'Saved amount', true); const deadline = input.deadline ? input.deadline : null; if (deadline) validDate(deadline)
  const color = /^#[0-9a-fA-F]{6}$/.test(input.color ?? '') ? input.color! : '#6f9879'
  const values = { name, targetAmount, savedAmount, deadline, color }
  if (input.id) await db.update(savingsGoals).set(values).where(and(eq(savingsGoals.id, input.id), eq(savingsGoals.userId, userId)))
  else await db.insert(savingsGoals).values({ ...values, userId })
  revalidateFinance()
}
export async function contributeToGoal(id: number, value: number) {
  const userId = await getUserId(); const addition = Number(amount(value, 'Contribution'))
  const [goal] = await db.select().from(savingsGoals).where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId))).limit(1)
  if (!goal) throw new Error('Savings goal not found')
  const savedAmount = Math.min(Number(goal.targetAmount), Number(goal.savedAmount) + addition).toFixed(2)
  await db.update(savingsGoals).set({ savedAmount }).where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)))
  revalidateFinance()
}
export async function deleteGoal(id: number) { const userId = await getUserId(); await db.delete(savingsGoals).where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId))); revalidateFinance() }

export async function saveRecurring(input: { id?: number; title: string; amount: number; category: string; transactionType: string; paymentMethod?: string; accountId?: number | null; frequency: string; startsOn: string; endsOn?: string }) {
  const userId = await getUserId(); const title = text(input.title, 'Description'); const category = text(input.category, 'Category', 40)
  if (!(frequencies as readonly string[]).includes(input.frequency)) throw new Error('Choose a valid repeat interval')
  if (!(transactionTypes as readonly string[]).includes(input.transactionType)) throw new Error('Choose expense or income')
  const startsOn = input.startsOn; validDate(startsOn); const endsOn = input.endsOn || null; if (endsOn && (validDate(endsOn) < validDate(startsOn))) throw new Error('End date must be after the start date')
  await assertAccount(userId, input.accountId)
  const values = { title, amount: amount(input.amount), category, transactionType: input.transactionType, paymentMethod: input.paymentMethod?.slice(0, 40) || null, accountId: input.accountId ?? null, frequency: input.frequency, startsOn, endsOn, nextDue: startsOn, enabled: true }
  if (input.id) await db.update(recurringTransactions).set(values).where(and(eq(recurringTransactions.id, input.id), eq(recurringTransactions.userId, userId)))
  else await db.insert(recurringTransactions).values({ ...values, userId })
  revalidateFinance()
}
export async function deleteRecurring(id: number) { const userId = await getUserId(); await db.update(recurringTransactions).set({ enabled: false }).where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId))); revalidateFinance() }

export async function importTransactions(rows: TransactionInput[]) {
  const userId = await getUserId(); if (!Array.isArray(rows) || rows.length > 1000) throw new Error('Import up to 1,000 rows at a time')
  const clean = rows.map((row) => ({ ...cleanTransaction(row), userId }))
  for (const row of clean) await assertAccount(userId, row.accountId)
  if (clean.length) await db.insert(expenses).values(clean)
  revalidateFinance(); return clean.length
}
export async function loadDemoData() {
  const userId = await getUserId(); const [existing] = await db.select({ value: count() }).from(expenses).where(eq(expenses.userId, userId))
  if (existing.value) throw new Error('Demo data is only available for a new, empty ledger')
  await ensureUserDefaults(userId)
  const data = [
    ['Market & Co.', 68.45, 'Food', 'expense', 'Card', 0], ['Monthly salary', 4200, 'Income', 'income', 'Bank', 1], ['Metro pass', 42, 'Transport', 'expense', 'Card', 2],
    ['Electricity bill', 88.2, 'Bills', 'expense', 'Bank', 6], ['Neighborhood grocer', 34.76, 'Food', 'expense', 'Cash', 9], ['Running shoes', 112, 'Shopping', 'expense', 'Card', 12],
    ['Pharmacy', 23.8, 'Health', 'expense', 'Card', 18], ['Coffee shop', 9.5, 'Food', 'expense', 'Cash', 23], ['Freelance project', 650, 'Income', 'income', 'Bank', 28],
    ['Weekly groceries', 75.9, 'Food', 'expense', 'Card', 35], ['Water bill', 31, 'Bills', 'expense', 'Bank', 40], ['Rideshare', 16.4, 'Transport', 'expense', 'Card', 48],
  ] as const
  const accounts = await db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId))
  const now = new Date()
  await db.insert(expenses).values(data.map(([title, value, category, transactionType, paymentMethod, days]) => ({
    userId, title, amount: String(value), category, transactionType, paymentMethod,
    accountId: accounts.find((account) => account.name === paymentMethod)?.id ?? null,
    transactionDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days, 12)),
  })))
  await db.insert(userBudgets).values({ userId, amount: '1800.00' }).onConflictDoUpdate({ target: userBudgets.userId, set: { amount: '1800.00' } })
  await db.insert(userCategoryBudgets).values([{ userId, category: 'Food', amount: '420' }, { userId, category: 'Bills', amount: '300' }, { userId, category: 'Transport', amount: '180' }]).onConflictDoNothing()
  await db.insert(savingsGoals).values({ userId, name: 'Weekend getaway', targetAmount: '1200', savedAmount: '540', deadline: dateOnly(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1))) })
  revalidateFinance()
}
export async function exportBackup() {
  const userId = await getUserId(); const data = await getLedgerData()
  return { version: 1, exportedAt: new Date().toISOString(), transactions: data.expenses, budgets: data.budget, categoryBudgets: data.categoryBudgets, preferences: data.preferences, categories: data.categories, accounts: data.accounts, transfers: data.transfers, goals: data.goals, recurring: data.schedules, owner: userId }
}
export async function resetAllData() {
  const userId = await getUserId()
  await db.transaction(async (tx) => {
    await tx.delete(expenses).where(eq(expenses.userId, userId))
    await tx.delete(financeTransfers).where(eq(financeTransfers.userId, userId))
    await tx.delete(recurringTransactions).where(eq(recurringTransactions.userId, userId))
    await tx.delete(savingsGoals).where(eq(savingsGoals.userId, userId))
    await tx.delete(userCategoryBudgets).where(eq(userCategoryBudgets.userId, userId))
    await tx.delete(userBudgets).where(eq(userBudgets.userId, userId))
    await tx.delete(userPreferences).where(eq(userPreferences.userId, userId))
    await tx.delete(financeCategories).where(eq(financeCategories.userId, userId))
    await tx.delete(financeAccounts).where(eq(financeAccounts.userId, userId))
  })
  try {
    let cursor: string | undefined
    do {
      const page = await list({ prefix: `users/${userId}/receipts/`, limit: 1000, cursor })
      if (page.blobs.length) await del(page.blobs.map((blob) => blob.pathname))
      cursor = page.cursor
    } while (cursor)
  } catch (error) {
    console.error('Receipt cleanup failed during account reset', error)
  }
  revalidateFinance()
}

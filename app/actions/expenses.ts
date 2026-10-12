'use server'

import { db } from '@/lib/db'
import { budgets, categoryBudgets, defaultCategories, expenses, preferences } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

const validTypes = ['expense', 'income'] as const
const cleanAmount = (value: number) => { const amount = Number(value); if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero'); return amount.toFixed(2) }
export async function getExpenses() { try { return await db.select().from(expenses).orderBy(desc(expenses.transactionDate), desc(expenses.createdAt)) } catch { return [] } }
export async function getBudget() { try { const [row] = await db.select().from(budgets).where(eq(budgets.id, 1)); return Number(row?.amount ?? 2000) } catch { return 2000 } }
export async function updateBudget(amount: number) { await db.insert(budgets).values({ id: 1, amount: cleanAmount(amount) }).onConflictDoUpdate({ target: budgets.id, set: { amount: cleanAmount(amount), updatedAt: new Date() } }); revalidatePath('/') }
export async function getCategoryBudgets() { try { return await db.select().from(categoryBudgets).orderBy(categoryBudgets.category) } catch { return [] } }
export async function updateCategoryBudget(category: string, amount: number) { const name = category.trim(); if (!name) throw new Error('Category is required'); const value = cleanAmount(amount); await db.insert(categoryBudgets).values({ category: name, amount: value }).onConflictDoUpdate({ target: categoryBudgets.category, set: { amount: value, updatedAt: new Date() } }); revalidatePath('/'); revalidatePath('/budgets') }
export async function deleteCategoryBudget(id: number) { if (!Number.isInteger(id)) throw new Error('Invalid budget'); await db.delete(categoryBudgets).where(eq(categoryBudgets.id, id)); revalidatePath('/budgets') }
export async function getPreferences() { try { const [row] = await db.select().from(preferences).where(eq(preferences.id, 1)); return row ?? { currency: 'USD', dateFormat: 'en-US' } } catch { return { currency: 'USD', dateFormat: 'en-US' } } }
export async function updatePreferences(input: { currency: string; dateFormat: string }) { const currency = input.currency.trim().toUpperCase(); const dateFormat = input.dateFormat.trim(); if (!['USD', 'EUR', 'GBP', 'INR'].includes(currency)) throw new Error('Unsupported currency'); await db.insert(preferences).values({ id: 1, currency, dateFormat }).onConflictDoUpdate({ target: preferences.id, set: { currency, dateFormat, updatedAt: new Date() } }); revalidatePath('/') }
export async function addExpense(input: { title: string; amount: number; category: string; transactionType?: string; transactionDate?: string; notes?: string; paymentMethod?: string }) { const title = input.title.trim(); const category = input.category.trim(); const type = input.transactionType ?? 'expense'; if (!title || !category || !validTypes.includes(type as typeof validTypes[number])) throw new Error('Invalid transaction'); await db.insert(expenses).values({ title, amount: cleanAmount(input.amount), category, transactionType: type, transactionDate: input.transactionDate ? new Date(input.transactionDate) : new Date(), notes: input.notes?.trim() || null, paymentMethod: input.paymentMethod?.trim() || null }); revalidatePath('/'); revalidatePath('/transactions'); revalidatePath('/insights') }
export async function updateExpense(id: number, input: Parameters<typeof addExpense>[0]) { if (!Number.isInteger(id)) throw new Error('Invalid transaction'); await db.update(expenses).set({ title: input.title.trim(), amount: cleanAmount(input.amount), category: input.category.trim(), transactionType: input.transactionType ?? 'expense', transactionDate: input.transactionDate ? new Date(input.transactionDate) : new Date(), notes: input.notes?.trim() || null, paymentMethod: input.paymentMethod?.trim() || null }).where(eq(expenses.id, id)); revalidatePath('/'); revalidatePath('/transactions') }
export async function deleteExpense(id: number) { if (!Number.isInteger(id)) throw new Error('Invalid transaction'); await db.delete(expenses).where(eq(expenses.id, id)); revalidatePath('/'); revalidatePath('/transactions'); revalidatePath('/insights') }
export async function exportExpenses() { return getExpenses() }


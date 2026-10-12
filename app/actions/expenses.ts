'use server'

import { db } from '@/lib/db'
import { budgets, expenses } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function getExpenses() {
  try {
    return await db.select().from(expenses).orderBy(desc(expenses.createdAt))
  } catch {
    return []
  }
}

export async function getBudget() {
  try {
    const [budget] = await db.select().from(budgets).where(eq(budgets.id, 1))
    return Number(budget?.amount ?? 2000)
  } catch {
    return 2000
  }
}

export async function updateBudget(amount: number) {
  const value = Number(amount)
  if (!Number.isFinite(value) || value <= 0) throw new Error('Invalid budget')
  await db.insert(budgets).values({ id: 1, amount: value.toFixed(2) }).onConflictDoUpdate({ target: budgets.id, set: { amount: value.toFixed(2), updatedAt: new Date() } })
  revalidatePath('/')
}

export async function addExpense(input: { title: string; amount: number; category: string }) {
  const title = input.title.trim()
  const amount = Number(input.amount)
  const category = input.category.trim()
  if (!title || !category || !Number.isFinite(amount) || amount <= 0) throw new Error('Invalid expense')
  await db.insert(expenses).values({ title, amount: amount.toFixed(2), category })
  revalidatePath('/')
}

export async function deleteExpense(id: number) {
  if (!Number.isInteger(id)) throw new Error('Invalid expense')
  await db.delete(expenses).where(eq(expenses.id, id))
  revalidatePath('/')
}

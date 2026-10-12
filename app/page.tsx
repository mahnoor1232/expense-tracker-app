import { getBudget, getExpenses } from './actions/expenses'
import { ExpenseTracker } from '@/components/expense-tracker'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [expenses, budget] = await Promise.all([getExpenses(), getBudget()])
  const now = new Date()
  const initialPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return <ExpenseTracker initialExpenses={expenses.map((expense) => ({ ...expense, amount: Number(expense.amount) }))} initialBudget={budget} initialPeriod={initialPeriod} />
}

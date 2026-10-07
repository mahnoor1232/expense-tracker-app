import { getBudget, getExpenses } from './actions/expenses'
import { ExpenseTracker } from '@/components/expense-tracker'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [expenses, budget] = await Promise.all([getExpenses(), getBudget()])
  return <ExpenseTracker initialExpenses={expenses.map((expense) => ({ ...expense, amount: Number(expense.amount) }))} initialBudget={budget} />
}

import { getExpenses } from './actions/expenses'
import { ExpenseTracker } from '@/components/expense-tracker'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const expenses = await getExpenses()
  return <ExpenseTracker initialExpenses={expenses.map((expense) => ({ ...expense, amount: Number(expense.amount) }))} />
}

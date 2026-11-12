import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getLedgerData } from '@/app/actions/expenses'
import { ExpenseTracker } from '@/components/expense-tracker'

export async function LedgerPage({ activePage }: { activePage: string }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  const data = await getLedgerData()
  return <ExpenseTracker initialData={data} activePage={activePage} user={{ name: session.user.name, email: session.user.email }} />
}

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getLedgerData } from '@/app/actions/expenses'
import { ExpenseTracker } from '@/components/expense-tracker'

export async function LedgerPage({ activePage, searchParams }: { activePage: string; searchParams?: Promise<{ month?: string | string[] }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  const data = await getLedgerData()
  const query = await searchParams
  const requestedMonth = Array.isArray(query?.month) ? query.month[0] : query?.month
  const initialMonth = requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : undefined
  return <ExpenseTracker initialData={data} activePage={activePage} initialMonth={initialMonth} user={{ name: session.user.name, email: session.user.email }} />
}

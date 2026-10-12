import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, CreditCard, Wallet } from 'lucide-react'
import { getExpenses } from '@/app/actions/expenses'

export const dynamic = 'force-dynamic'

export default async function TransactionsPage() {
  const expenses = await getExpenses()
  const total = expenses.reduce((sum, item) => sum + Number(item.amount), 0)
  return <main className="min-h-screen bg-[#f5f6f2] px-5 py-8 text-[#26322b] sm:px-10 lg:px-20 lg:py-12">
    <div className="mx-auto max-w-5xl">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#6f9879] hover:text-[#294438]"><ArrowLeft className="size-4" /> Back to overview</Link>
      <header className="mt-10 flex flex-wrap items-end justify-between gap-5"><div><p className="text-sm font-medium text-[#6f9879]">Your money trail</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">All transactions</h1><p className="mt-3 text-sm text-slate-500">Review every purchase in one calm, searchable place.</p></div><div className="rounded-2xl bg-[#294438] px-5 py-4 text-white"><p className="text-xs text-white/60">Lifetime tracked</p><p className="mt-1 text-2xl font-semibold">${total.toFixed(2)}</p></div></header>
      <section className="mt-10 overflow-hidden rounded-2xl border border-[#dfe4dc] bg-white shadow-sm"><div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-[#e8ece5] px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400"><span>Transaction</span><span>Category</span><span>Amount</span></div>{expenses.length ? expenses.map((expense) => <div key={expense.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-[#eef1ec] px-5 py-4 last:border-0"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-[#eef3eb] text-[#6f9879]"><CreditCard className="size-4" /></div><div><p className="text-sm font-semibold">{expense.title}</p><p className="text-xs text-slate-400">{new Date(expense.createdAt).toLocaleDateString()}</p></div></div><span className="rounded-full bg-[#f2f4ef] px-3 py-1 text-xs font-medium text-slate-500">{expense.category}</span><span className="text-sm font-semibold">${Number(expense.amount).toFixed(2)}</span></div>) : <div className="px-5 py-16 text-center text-sm text-slate-400">Your transaction history will appear here.</div>}</section>
      <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#294438] px-4 py-3 text-sm font-semibold text-white hover:bg-[#355746]"><Wallet className="size-4" /> Add a new expense <ArrowUpRight className="size-4" /></Link>
    </div>
  </main>
}

'use client'

import { useMemo, useState, useTransition } from 'react'
import { addExpense, deleteExpense } from '@/app/actions/expenses'
import { ArrowDownLeft, Car, ChevronDown, Coffee, MoreHorizontal, Plus, ShoppingBag, Sparkles, Trash2, Utensils } from 'lucide-react'

type Expense = { id: number; title: string; amount: string | number; category: string; createdAt: Date }

const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Other']
const categoryIcons = { Food: Utensils, Transport: Car, Shopping: ShoppingBag, Bills: Sparkles, Other: MoreHorizontal }
const categoryColors = { Food: 'bg-amber-100 text-amber-700', Transport: 'bg-sky-100 text-sky-700', Shopping: 'bg-fuchsia-100 text-fuchsia-700', Bills: 'bg-emerald-100 text-emerald-700', Other: 'bg-slate-100 text-slate-600' }

function formatMoney(value: number | string) { return `$${Number(value).toFixed(2)}` }
function formatDate(value: Date) { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) }

export function ExpenseTracker({ initialExpenses }: { initialExpenses: Expense[] }) {
  const [items, setItems] = useState(initialExpenses)
  const [filter, setFilter] = useState('All expenses')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food')
  const [isPending, startTransition] = useTransition()

  const filteredItems = useMemo(() => filter === 'All expenses' ? items : items.filter((item) => item.category === filter), [filter, items])
  const total = items.reduce((sum, item) => sum + Number(item.amount), 0)
  const filteredTotal = filteredItems.reduce((sum, item) => sum + Number(item.amount), 0)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedAmount = Number(amount)
    if (!title.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return
    const optimistic = { id: Date.now(), title: title.trim(), amount: parsedAmount, category, createdAt: new Date() }
    setItems((current) => [optimistic, ...current])
    setTitle(''); setAmount('')
    startTransition(async () => { try { await addExpense({ title: optimistic.title, amount: parsedAmount, category }) } catch { setItems((current) => current.filter((item) => item.id !== optimistic.id)) } })
  }

  function handleDelete(id: number) {
    const previous = items
    setItems((current) => current.filter((item) => item.id !== id))
    startTransition(async () => { try { await deleteExpense(id) } catch { setItems(previous) } })
  }

  return <main className="expense-app min-h-screen bg-[#f4f1eb] text-[#26322b]">
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-7 sm:px-8 lg:px-12">
      <header className="flex items-center justify-between border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-2xl bg-slate-900 text-white"><ArrowDownLeft className="size-5" /></div><div><p className="text-sm font-semibold tracking-tight">Pocket</p><p className="text-xs text-slate-500">Personal finance</p></div></div>
        <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><span className="size-2 rounded-full bg-emerald-500" /> Synced just now</div>
      </header>
      <section className="grid flex-1 gap-8 py-10 lg:grid-cols-[1fr_360px] lg:gap-16 lg:py-14">
        <div>
          <div className="mb-10"><p className="mb-3 text-sm font-medium text-slate-500">September 2026</p><div className="flex items-end justify-between gap-4"><div><h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Keep it simple.</h1><p className="mt-3 max-w-md text-sm leading-6 text-slate-500">A clear view of where your money goes, one expense at a time.</p></div><div className="hidden text-right sm:block"><p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total spent</p><p className="mt-1 text-2xl font-semibold tracking-tight">{formatMoney(total)}</p></div></div></div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Recent expenses <span className="ml-1 text-sm font-normal text-slate-400">{filteredItems.length}</span></h2><label className="relative"><span className="sr-only">Filter expenses</span><select value={filter} onChange={(event) => setFilter(event.target.value)} className="appearance-none rounded-full border border-slate-200 bg-white py-2 pl-4 pr-9 text-xs font-medium text-slate-600 shadow-sm outline-none transition focus:border-slate-400"><option>All expenses</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" /></label></div>
          <div className="divide-y divide-slate-200/80 rounded-2xl border border-slate-200/80 bg-white px-4 shadow-sm">{filteredItems.length ? filteredItems.map((item) => { const Icon = categoryIcons[item.category as keyof typeof categoryIcons] || MoreHorizontal; return <div key={item.id} className="flex items-center gap-3 py-4"><div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${categoryColors[item.category as keyof typeof categoryColors] || categoryColors.Other}`}><Icon className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-slate-400">{item.category} · {formatDate(item.createdAt)}</p></div><p className="text-sm font-semibold">{formatMoney(item.amount)}</p><button type="button" aria-label={`Delete ${item.title}`} onClick={() => handleDelete(item.id)} className="ml-2 rounded-lg p-2 text-slate-300 transition hover:bg-red-50 hover:text-red-500"><Trash2 className="size-4" /></button></div> }) : <div className="py-16 text-center"><p className="text-sm font-medium">No expenses here yet</p><p className="mt-1 text-xs text-slate-400">Try another category or add a new expense.</p></div>}</div>
          {filter !== 'All expenses' && <p className="mt-4 text-xs text-slate-400">Showing {formatMoney(filteredTotal)} in {filter}</p>}
        </div>
        <aside className="self-start rounded-3xl bg-slate-900 p-6 text-white shadow-xl shadow-slate-900/10"><div className="mb-8 flex items-start justify-between"><div><p className="text-sm font-medium text-slate-300">Add expense</p><p className="mt-1 text-xs text-slate-500">Log it while it&apos;s fresh.</p></div><div className="flex size-9 items-center justify-center rounded-xl bg-white/10"><Plus className="size-4" /></div></div><form onSubmit={handleSubmit} className="flex flex-col gap-5"><div><label htmlFor="expense-title" className="mb-2 block text-xs font-medium text-slate-400">What did you spend on?</label><input id="expense-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Morning coffee" className="w-full border-b border-white/20 bg-transparent pb-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-white/70" /></div><div><label htmlFor="expense-amount" className="mb-2 block text-xs font-medium text-slate-400">Amount</label><div className="flex items-center border-b border-white/20 pb-2"><span className="mr-2 text-lg text-slate-500">$</span><input id="expense-amount" inputMode="decimal" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" className="w-full bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-slate-600" /></div></div><div><label htmlFor="expense-category" className="mb-2 block text-xs font-medium text-slate-400">Category</label><select id="expense-category" value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm text-white outline-none focus:border-white/40">{categories.map((item) => <option className="text-slate-900" key={item}>{item}</option>)}</select></div><button type="submit" disabled={isPending} className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"><Plus className="size-4" /> Add expense</button></form></aside>
      </section>
      <footer className="flex items-center justify-between border-t border-slate-200/80 py-5 text-xs text-slate-400"><span>Spend mindfully.</span><span>{items.length} total {items.length === 1 ? 'expense' : 'expenses'}</span></footer>
    </div>
  </main>
}

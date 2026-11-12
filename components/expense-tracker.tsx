'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BarChart3, CalendarDays, CarFront, Check, ChevronDown, Circle, CircleDollarSign, CreditCard, Download, FileUp, Filter, HeartPulse, House, LayoutDashboard, LogOut, Moon, MoreHorizontal, Plus, Printer, Search, Settings2, ShoppingBag, Sparkles, Sun, Trash2, TrendingDown, TrendingUp, Utensils, Wallet, X } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { addExpense, contributeToGoal, deleteAccount, deleteCategory, deleteExpense, deleteGoal, deleteRecurring, exportBackup, getLedgerData, importTransactions, loadDemoData, resetAllData, restoreExpense, saveAccount, saveCategory, saveGoal, saveRecurring, searchTransactions, transferBetweenAccounts, updateBudget, updateCategoryBudget, updateExpense, updatePreferences } from '@/app/actions/expenses'
import { SpendingCharts } from '@/components/finance-charts'
import type { Expense } from '@/lib/db/schema'

 type LedgerData = Awaited<ReturnType<typeof getLedgerData>>
 type ActivePage = 'overview' | 'transactions' | 'insights' | 'budgets' | 'settings' | 'reports'
 type UserSummary = { name: string; email: string }
const navItems = [
  { id: 'overview', label: 'Overview', href: '/', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', href: '/transactions', icon: CreditCard },
  { id: 'insights', label: 'Insights', href: '/insights', icon: BarChart3 },
  { id: 'budgets', label: 'Budgets', href: '/budgets', icon: TrendingUp },
  { id: 'settings', label: 'Settings', href: '/settings', icon: Settings2 },
  { id: 'reports', label: 'Reports', href: '/reports', icon: Activity },
] as const
const currencyNames: Record<string, string> = { USD: 'US Dollar', PKR: 'Pakistani Rupee', EUR: 'Euro', GBP: 'British Pound', INR: 'Indian Rupee', CAD: 'Canadian Dollar', AUD: 'Australian Dollar', JPY: 'Japanese Yen', NZD: 'New Zealand Dollar', CHF: 'Swiss Franc' }
const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0)
const dayString = (value: Date | string) => new Date(value).toISOString().slice(0, 10)
const displayDate = (value: Date | string, locale = 'en-US') => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1)
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export function ExpenseTracker({ initialData, activePage, user }: { initialData: LedgerData; activePage: string; user: UserSummary }) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [items, setItems] = useState<Expense[]>(initialData.expenses)
  const [active, setActive] = useState<ActivePage>((activePage as ActivePage) || 'overview')
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [sort, setSort] = useState('date-desc')
  const [page, setPage] = useState(1)
  const [showTransactionForm, setShowTransactionForm] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [receiptPath, setReceiptPath] = useState<string | null>(null)
  const [receiptPending, setReceiptPending] = useState(false)
  const [undoRow, setUndoRow] = useState<Expense | null>(null)
  const [budgetValue, setBudgetValue] = useState(String(data.budget.amount))
  const [categoryBudgetName, setCategoryBudgetName] = useState(data.categories[0]?.name ?? 'Food')
  const [categoryBudgetValue, setCategoryBudgetValue] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const currency = data.preferences.currency
  const locale = data.preferences.dateFormat
  const todayMonth = monthKey(new Date())
  const currentMonthTransactions = items.filter((item) => monthKey(new Date(item.transactionDate)) === todayMonth)
  const monthSpent = currentMonthTransactions.filter((item) => item.transactionType === 'expense').reduce((sum, item) => sum + Number(item.amount), 0)
  const monthIncome = currentMonthTransactions.filter((item) => item.transactionType === 'income').reduce((sum, item) => sum + Number(item.amount), 0)
  const previousMonthDate = new Date()
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1)
  const previousMonthSpent = items.filter((item) => item.transactionType === 'expense' && monthKey(new Date(item.transactionDate)) === monthKey(previousMonthDate)).reduce((sum, item) => sum + Number(item.amount), 0)
  const baseBudget = Number(data.budget.amount)
  const budget = baseBudget + (data.budget.rollover ? Math.max(0, baseBudget - previousMonthSpent) : 0)
  const remaining = budget - monthSpent
  const usedPercent = budget > 0 ? monthSpent / budget * 100 : 0
  const filteredTransactions = useMemo(() => items.filter((item) => {
    const date = new Date(item.transactionDate)
    const q = query.trim().toLowerCase()
    return (!q || [item.title, item.category, item.paymentMethod, item.notes, ...(item.tags ?? [])].some((value) => String(value ?? '').toLowerCase().includes(q))) &&
      (categoryFilter === 'all' || item.category === categoryFilter) &&
      (methodFilter === 'all' || item.paymentMethod === methodFilter) &&
      (typeFilter === 'all' || item.transactionType === typeFilter) &&
      (!startDateFilter || date >= new Date(`${startDateFilter}T00:00:00`)) &&
      (!endDateFilter || date <= new Date(`${endDateFilter}T23:59:59`))
  }).sort((a, b) => sort === 'date-asc' ? +new Date(a.transactionDate) - +new Date(b.transactionDate) : sort === 'amount-desc' ? Number(b.amount) - Number(a.amount) : sort === 'amount-asc' ? Number(a.amount) - Number(b.amount) : +new Date(b.transactionDate) - +new Date(a.transactionDate)), [items, query, categoryFilter, methodFilter, typeFilter, startDateFilter, endDateFilter, sort])
  const pageSize = 10
  const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / pageSize))
  const visibleTransactions = filteredTransactions.slice((page - 1) * pageSize, page * pageSize)
  const expenseCategories = data.categories.filter((category) => category.name !== 'Income')

  useEffect(() => { setData(initialData); setItems(initialData.expenses); setBudgetValue(String(initialData.budget.amount)) }, [initialData])
  useEffect(() => { document.documentElement.dataset.theme = data.preferences.theme }, [data.preferences.theme])
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 4200); return () => window.clearTimeout(timer) }, [notice])
  useEffect(() => { if (!undoRow) return; const timer = window.setTimeout(() => setUndoRow(null), 7000); return () => window.clearTimeout(timer) }, [undoRow])
  useEffect(() => { setPage(1) }, [query, categoryFilter, methodFilter, typeFilter, startDateFilter, endDateFilter, sort])

  function run(task: () => Promise<unknown>, success: string) {
    setError('')
    startTransition(async () => {
      try { await task(); setNotice(success); router.refresh() }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.') }
    })
  }
  function openCreateTransaction() { setEditing(null); setReceiptPath(null); setShowTransactionForm(true); setError(''); document.getElementById('transaction-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
  function editTransaction(item: Expense) { setEditing(item); setReceiptPath(item.receiptPath); setShowTransactionForm(true); setError(''); document.getElementById('transaction-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
  async function submitTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const amount = Number(form.get('amount'))
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter an amount greater than zero.'); return }
    const payload = {
      title: String(form.get('title') ?? ''), amount, category: String(form.get('category') ?? 'Other'),
      transactionType: String(form.get('transactionType') ?? 'expense'), transactionDate: String(form.get('transactionDate') ?? dayString(new Date())),
      paymentMethod: String(form.get('paymentMethod') ?? ''), accountId: form.get('accountId') ? Number(form.get('accountId')) : null,
      notes: String(form.get('notes') ?? ''), tags: String(form.get('tags') ?? '').split(',').map((tag) => tag.trim()).filter(Boolean), receiptPath,
    }
    setError('')
    startTransition(async () => {
      try {
        if (editing) await updateExpense(editing.id, payload)
        else await addExpense(payload)
        setShowTransactionForm(false); setEditing(null); setReceiptPath(null); setNotice(editing ? 'Transaction updated.' : 'Transaction added.')
        router.refresh()
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this transaction.') }
    })
  }
  async function uploadReceipt(file?: File) {
    if (!file) return
    setReceiptPending(true); setError('')
    try {
      const body = new FormData(); body.set('file', file)
      const response = await fetch('/api/receipts', { method: 'POST', body })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Receipt upload failed')
      setReceiptPath(result.pathname); setNotice('Receipt attached securely.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Receipt upload failed.') }
    finally { setReceiptPending(false) }
  }
  async function removeTransaction(item: Expense) {
    if (!window.confirm(`Delete “${item.title}”? You can undo this for a few seconds.`)) return
    try {
      const removed = await deleteExpense(item.id)
      setItems((current) => current.filter((row) => row.id !== item.id)); setUndoRow(removed); setNotice('Transaction deleted.'); router.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete transaction.') }
  }
  async function undoDelete() {
    if (!undoRow) return
    const { id: _id, createdAt: _createdAt, ...rest } = undoRow
    try { await restoreExpense(rest); setUndoRow(null); setNotice('Transaction restored.'); router.refresh() }
    catch { setError('Could not restore the transaction.') }
  }
  async function exportCsv() {
    const rows = await searchTransactions({ page: 1, pageSize: 100, sort: 'date-desc' })
    const all = rows.total > 100 ? await (async () => { const result = []; for (let p = 1; p <= Math.ceil(rows.total / 100); p++) result.push(...(await searchTransactions({ page: p, pageSize: 100, sort: 'date-desc' })).rows); return result })() : rows.rows
    const values = [['date','description','type','category','amount','payment method','notes','tags'], ...all.map((row) => [dayString(row.transactionDate), row.title, row.transactionType, row.category, row.amount, row.paymentMethod ?? '', row.notes ?? '', (row.tags ?? []).join('|')])]
    downloadFile('ledger-transactions.csv', values.map((row) => row.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8')
  }
  async function importCsv() {
    if (!csvFile) return
    try {
      const rows = parseCsv(await csvFile.text())
      const count = await importTransactions(rows)
      setCsvFile(null); setNotice(`${count} transactions imported.`); router.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not import this CSV file.') }
  }
  function exportReportCsv() {
    const period = monthKey(new Date())
    const transactions = items.filter((item) => monthKey(new Date(item.transactionDate)) === period)
    const rows: unknown[][] = [['period', 'type', 'category', 'transaction_count', 'amount']]
    for (const category of data.categories) {
      for (const type of ['expense', 'income'] as const) {
        const matching = transactions.filter((item) => item.category === category.name && item.transactionType === type)
        if (matching.length) rows.push([period, type, category.name, matching.length, matching.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2)])
      }
    }
    downloadFile(`ledger-report-${period}.csv`, rows.map((row) => row.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8')
  }
  async function exportFullBackup() {
    try { const backup = await exportBackup(); downloadFile('ledger-backup.json', JSON.stringify(backup, null, 2), 'application/json'); setNotice('Private data backup downloaded.') }
    catch { setError('Could not create a backup.') }
  }
  async function signOut() { await authClient.signOut(); router.replace('/sign-in'); router.refresh() }

  const pageTitle = navItems.find((item) => item.id === active)?.label ?? 'Overview'
  const root = <main className="expense-app ledger-app min-h-screen">
    <div className="ledger-layout">
      <aside className="ledger-sidebar">
        <Link href="/" className="ledger-brand"><span className="brand-mark small-mark"><Wallet aria-hidden="true" /></span><span><strong>Ledger</strong><small>Personal finance</small></span></Link>
        <p className="sidebar-label">Workspace</p>
        <nav aria-label="Main navigation" className="main-nav">
          {navItems.map(({ id, label, href, icon: Icon }) => <Link key={id} href={href} aria-current={active === id ? 'page' : undefined} className={`nav-link ${active === id ? 'active' : ''}`}><Icon aria-hidden="true" /><span>{label}</span></Link>)}
        </nav>
        <div className="sidebar-budget"><p className="eyebrow">MONTHLY PLAN</p><strong>{money(monthSpent, currency)}</strong><span>of {money(budget, currency)}</span><div className="progress-track"><span style={{ width: `${Math.min(100, usedPercent)}%` }} /></div><Link href="/budgets">Manage budgets <span aria-hidden="true">→</span></Link></div>
        <div className="sidebar-user"><span className="avatar">{(user.name || user.email).slice(0, 1).toUpperCase()}</span><span className="user-text"><strong>{user.name || 'My account'}</strong><small>{user.email}</small></span><button type="button" className="icon-button" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut /></button></div>
      </aside>
      <div className="ledger-main">
        <header className="topbar"><div><p className="eyebrow">YOUR MONEY, CLEARLY</p><h1>{pageTitle}</h1></div><div className="top-actions"><span className="today-label"><CalendarDays aria-hidden="true" />{displayDate(new Date(), locale)}</span><button type="button" className="icon-button mobile-signout" aria-label="Sign out" onClick={signOut}><LogOut aria-hidden="true" /></button><button type="button" className="primary-button desktop-add" onClick={openCreateTransaction}><Plus aria-hidden="true" /> Add transaction</button></div></header>
        {error && <div className="alert alert-error" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X /></button></div>}
        {notice && <div className="toast" role="status" aria-live="polite"><Check aria-hidden="true" />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification"><X /></button></div>}
        {active === 'overview' && <Overview data={data} items={items} currency={currency} user={user} monthSpent={monthSpent} monthIncome={monthIncome} budget={budget} remaining={remaining} openAdd={openCreateTransaction} onPage={setActive} />}
        {active === 'transactions' && <TransactionsPanel items={items} data={data} currency={currency} locale={locale} query={query} setQuery={(v) => { setQuery(v); setPage(1) }} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} methodFilter={methodFilter} setMethodFilter={setMethodFilter} typeFilter={typeFilter} setTypeFilter={setTypeFilter} startDate={startDateFilter} setStartDate={setStartDateFilter} endDate={endDateFilter} setEndDate={setEndDateFilter} sort={sort} setSort={setSort} page={page} setPage={setPage} pageCount={pageCount} visible={visibleTransactions} total={filteredTransactions.length} openAdd={openCreateTransaction} edit={editTransaction} remove={removeTransaction} exportCsv={exportCsv} csvFile={csvFile} setCsvFile={setCsvFile} importCsv={importCsv} pending={pending} />}
        {active === 'insights' && <InsightsPanel data={data} items={items} currency={currency} />}
        {active === 'budgets' && <BudgetsPanel data={data} items={items} currency={currency} budgetValue={budgetValue} setBudgetValue={setBudgetValue} categoryBudgetName={categoryBudgetName} setCategoryBudgetName={setCategoryBudgetName} categoryBudgetValue={categoryBudgetValue} setCategoryBudgetValue={setCategoryBudgetValue} run={run} />}
        {active === 'settings' && <SettingsPanel data={data} currency={currency} run={run} exportBackup={exportFullBackup} csvFile={csvFile} setCsvFile={setCsvFile} importCsv={importCsv} pending={pending} />}
        {active === 'reports' && <ReportsPanel data={data} items={items} currency={currency} exportCsv={exportReportCsv} exportBackup={exportFullBackup} />}
        <footer className="ledger-footer"><span>Ledger · Private by design</span><span>Currency: {currency}</span></footer>
      </div>
      <button type="button" className="mobile-fab" aria-label="Add transaction" onClick={openCreateTransaction}><Plus aria-hidden="true" /></button>
    </div>
    {showTransactionForm && <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) { setShowTransactionForm(false); setEditing(null) } }}>
      <section id="transaction-form" role="dialog" aria-modal="true" aria-labelledby="transaction-form-title" className="transaction-dialog" onKeyDown={(event) => { if (event.key === 'Escape') { setShowTransactionForm(false); setEditing(null) } if (event.key === 'Tab') { const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]')); const first = focusable[0]; const last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() } } }}>
        <div className="panel-heading"><div><p className="eyebrow">{editing ? 'UPDATE RECORD' : 'NEW RECORD'}</p><h2 id="transaction-form-title">{editing ? 'Edit transaction' : 'Add a transaction'}</h2></div><button type="button" className="icon-button" aria-label="Close form" onClick={() => { setShowTransactionForm(false); setEditing(null) }}><X /></button></div>
        <form onSubmit={submitTransaction} className="form-grid" key={editing?.id ?? 'new'}>
          <label className="field field-wide">Description<input name="title" required maxLength={120} defaultValue={editing?.title} placeholder="e.g. Grocery run" autoFocus /></label>
          <label className="field">Amount<input name="amount" type="number" min="0.01" max="100000000" step="0.01" required defaultValue={editing ? Number(editing.amount) : ''} placeholder="0.00" /></label>
          <label className="field">Type<select name="transactionType" defaultValue={editing?.transactionType ?? 'expense'}><option value="expense">Expense</option><option value="income">Income</option></select></label>
          <label className="field">Category<select name="category" defaultValue={editing?.category ?? 'Food'}>{data.categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
          <label className="field">Date<input name="transactionDate" type="date" required defaultValue={editing ? dayString(editing.transactionDate) : dayString(new Date())} /></label>
          <label className="field">Account<select name="accountId" defaultValue={editing?.accountId ?? ''}><option value="">No account</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          <label className="field">Payment method<input name="paymentMethod" maxLength={40} defaultValue={editing?.paymentMethod ?? ''} placeholder="Card, cash, transfer…" /></label>
          <label className="field field-wide">Note<input name="notes" maxLength={500} defaultValue={editing?.notes ?? ''} placeholder="Optional details" /></label>
          <label className="field field-wide">Tags<input name="tags" maxLength={250} defaultValue={editing?.tags?.join(', ') ?? ''} placeholder="Add tags separated by commas" /><small>Up to 10 tags.</small></label>
          <div className="field field-wide"><span className="field-label">Receipt image</span><div className="upload-row"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="Upload receipt image" onChange={(event) => uploadReceipt(event.target.files?.[0])} disabled={receiptPending} /><span>{receiptPending ? 'Uploading privately…' : receiptPath ? 'Receipt attached' : 'JPG, PNG, GIF, or WebP · max 5 MB'}</span>{receiptPath && <button className="text-button" type="button" onClick={() => setReceiptPath(null)}>Remove</button>}</div></div>
          <div className="dialog-actions field-wide"><button type="button" className="secondary-button" onClick={() => { setShowTransactionForm(false); setEditing(null) }}>Cancel</button><button className="primary-button" type="submit" disabled={pending || receiptPending}>{pending ? 'Saving…' : editing ? 'Save changes' : 'Add transaction'}</button></div>
        </form>
      </section>
    </div>}
    {undoRow && <div className="undo-toast" role="status"><span>Transaction deleted</span><button type="button" onClick={undoDelete}>Undo</button><button type="button" aria-label="Dismiss undo" onClick={() => setUndoRow(null)}><X /></button></div>}
  </main>
  return root
}

function Overview({ data, items, currency, user, monthSpent, monthIncome, budget, remaining, openAdd, onPage }: { data: LedgerData; items: Expense[]; currency: string; user: UserSummary; monthSpent: number; monthIncome: number; budget: number; remaining: number; openAdd: () => void; onPage: (page: ActivePage) => void }) {
  const percent = budget ? monthSpent / budget * 100 : 0
  const expensesThisMonth = items.filter((item) => item.transactionType === 'expense' && monthKey(new Date(item.transactionDate)) === monthKey(new Date()))
  const categoriesThisMonth = data.categories.map((category) => ({ category, spent: expensesThisMonth.filter((row) => row.category === category.name).reduce((sum, row) => sum + Number(row.amount), 0), plan: Number(data.categoryBudgets.find((budget) => budget.category === category.name)?.amount ?? 0) })).filter((row) => row.plan > 0 || row.spent > 0)
  const dueSoon = data.schedules.filter((schedule) => { const delta = (new Date(`${schedule.nextDue}T00:00:00Z`).getTime() - new Date(`${dayString(new Date())}T00:00:00Z`).getTime()) / 86400000; return delta >= 0 && delta <= 30 }).slice(0, 4)
  const hasData = items.length > 0
  const previousMonth = new Date(); previousMonth.setMonth(previousMonth.getMonth() - 1)
  const prevSpent = items.filter((item) => item.transactionType === 'expense' && monthKey(new Date(item.transactionDate)) === monthKey(previousMonth)).reduce((sum, item) => sum + Number(item.amount), 0)
  const foodNow = expensesThisMonth.filter((item) => item.category.toLowerCase().includes('food')).reduce((sum, item) => sum + Number(item.amount), 0)
  const foodPrior = items.filter((item) => item.transactionType === 'expense' && item.category.toLowerCase().includes('food') && monthKey(new Date(item.transactionDate)) === monthKey(previousMonth)).reduce((sum, item) => sum + Number(item.amount), 0)
  return <div className="page-content">
    <section className="welcome-row"><div><p className="eyebrow">{new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date())}</p><h2>Good to see you, {user.name?.split(' ')[0] || 'there'}.</h2><p>Your finances, thoughtfully organized in one place.</p></div><button className="secondary-button" onClick={() => onPage('reports')}><Download aria-hidden="true" /> Export report</button></section>
    {!hasData && <section className="panel onboarding-card"><div className="onboarding-icon"><Sparkles aria-hidden="true" /></div><div><p className="eyebrow">A FRESH START</p><h2>Welcome to your new ledger</h2><p>Add a transaction to begin, or load a small set of sample data to explore your dashboard.</p><div className="button-row"><button className="primary-button" onClick={openAdd}><Plus aria-hidden="true" /> Add your first transaction</button><button className="secondary-button" onClick={() => { void loadDemoData().then(() => location.reload()).catch((cause) => alert(cause instanceof Error ? cause.message : 'Could not load demo data.')) }}>Load demo data</button></div></div></section>}
    {percent >= 80 && <div className={`alert ${percent >= 100 ? 'alert-error' : 'alert-warning'}`} role="status"><CircleDollarSign aria-hidden="true" /><span>{percent >= 100 ? 'You have reached your monthly budget.' : `You’ve used ${Math.round(percent)}% of your monthly budget.`} <Link href="/budgets">Review your plan</Link></span></div>}
    <div className="metrics-grid">
      <Metric label="Spent this month" value={money(monthSpent, currency)} icon={<ArrowUpRight />} tone="soft" note={`${expensesThisMonth.length} transactions`} />
      <Metric label="Income this month" value={money(monthIncome, currency)} icon={<ArrowDownLeft />} tone="sage" note="Across all accounts" />
      <Metric label="Budget remaining" value={money(remaining, currency)} icon={<Wallet />} tone={remaining < 0 ? 'warning' : 'dark'} note={`${Math.max(0, 100 - Math.round(percent))}% left in plan`} />
      <Metric label="Net cash flow" value={money(monthIncome - monthSpent, currency)} icon={monthIncome >= monthSpent ? <TrendingUp /> : <TrendingDown />} tone="plain" note="Income less spending" />
    </div>
    <SpendingCharts transactions={items} categories={data.categories} currency={currency} />
    <div className="two-column-grid">
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Latest transactions</h2></div><button className="text-button" onClick={() => onPage('transactions')}>All transactions <span aria-hidden="true">→</span></button></div>
        {items.length ? <div className="transaction-list">{items.slice(0, 5).map((item) => <TransactionRow key={item.id} item={item} currency={currency} locale={data.preferences.dateFormat} compact />)}</div> : <EmptyState title="Nothing here yet" copy="Add a transaction and your recent activity will show up here." onClick={openAdd} />}
      </section>
      <div className="widget-stack">
        <section className="panel budget-widget"><div className="panel-heading"><div><p className="eyebrow">MONTHLY BUDGET</p><h2>Your plan</h2></div><button className="icon-button" aria-label="Manage budgets" onClick={() => onPage('budgets')}><ChevronDown /></button></div><div className="budget-total"><strong>{money(monthSpent, currency)}</strong><span>of {money(budget, currency)}</span></div><Progress value={percent} /><p className="budget-caption">{money(Math.max(0, remaining), currency)} remaining this month</p>
          <div className="category-progress-list">{categoriesThisMonth.slice(0, 3).map(({ category, spent, plan }) => <div key={category.id}><div className="inline-between"><span>{category.name}</span><small>{plan ? `${money(spent, currency)} / ${money(plan, currency)}` : `${money(spent, currency)} spent`}</small></div><Progress value={plan ? spent / plan * 100 : 0} /></div>)}</div><Link href="/budgets" className="subtle-link">Adjust budgets <span aria-hidden="true">→</span></Link>
        </section>
        <section className="panel"><div className="panel-heading"><div><p className="eyebrow">NEXT 30 DAYS</p><h2>Upcoming bills</h2></div><CalendarDays aria-hidden="true" className="heading-icon" /></div>
          {dueSoon.length ? <ul className="upcoming-list">{dueSoon.map((bill) => <li key={bill.id}><span className="bill-date">{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${bill.nextDue}T00:00:00Z`))}</span><span className="bill-info"><strong>{bill.title}</strong><small>{bill.frequency} · {bill.category}</small></span><b>{money(Number(bill.amount), currency)}</b></li>)}</ul> : <p className="empty-inline">No bills coming up. Add a recurring payment in Settings.</p>}
        </section>
      </div>
    </div>
    <section className="panel accounts-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR MONEY</p><h2>Accounts & savings goals</h2></div><button className="text-button" onClick={() => onPage('settings')}>Manage <span aria-hidden="true">→</span></button></div><div className="account-grid">{data.accounts.map((account) => <div className="account-tile" key={account.id}><span className="account-icon"><Wallet aria-hidden="true" /></span><span><small>{account.name}</small><strong>{money(account.balance, account.currency || currency)}</strong></span></div>)}{data.goals.slice(0, 2).map((goal) => <div className="account-tile goal-tile" key={`goal-${goal.id}`}><span className="goal-ring" style={{ '--goal-progress': `${Math.min(100, Number(goal.savedAmount) / Number(goal.targetAmount) * 100)}%` } as React.CSSProperties}><span>{Math.round(Number(goal.savedAmount) / Number(goal.targetAmount) * 100)}%</span></span><span><small>{goal.name}</small><strong>{money(Number(goal.savedAmount), currency)} of {money(Number(goal.targetAmount), currency)}</strong></span></div>)}</div></section>
    {foodPrior > 0 && <InsightCallout text={foodNow > foodPrior ? `Food spending is up ${Math.round((foodNow - foodPrior) / foodPrior * 100)}% compared with last month.` : `Food spending is down ${Math.round((foodPrior - foodNow) / foodPrior * 100)}% compared with last month.`} />}
  </div>
}

function TransactionsPanel({ items, data, currency, locale, query, setQuery, categoryFilter, setCategoryFilter, methodFilter, setMethodFilter, typeFilter, setTypeFilter, startDate, setStartDate, endDate, setEndDate, sort, setSort, page, setPage, pageCount, visible, total, openAdd, edit, remove, exportCsv, csvFile, setCsvFile, importCsv, pending }: { items: Expense[]; data: LedgerData; currency: string; locale: string; query: string; setQuery: (value: string) => void; categoryFilter: string; setCategoryFilter: (value: string) => void; methodFilter: string; setMethodFilter: (value: string) => void; typeFilter: string; setTypeFilter: (value: string) => void; startDate: string; setStartDate: (value: string) => void; endDate: string; setEndDate: (value: string) => void; sort: string; setSort: (value: string) => void; page: number; setPage: (value: number) => void; pageCount: number; visible: Expense[]; total: number; openAdd: () => void; edit: (item: Expense) => void; remove: (item: Expense) => void; exportCsv: () => void; csvFile: File | null; setCsvFile: (file: File | null) => void; importCsv: () => void; pending: boolean }) {
  const methods = [...new Set(items.map((item) => item.paymentMethod).filter(Boolean))] as string[]
  return <div className="page-content"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">YOUR LEDGER</p><h2>All transactions</h2><p className="panel-copy">Search, review, and update your activity.</p></div><div className="button-row"><button className="secondary-button" onClick={exportCsv}><Download aria-hidden="true" /> Export CSV</button><button className="primary-button" onClick={openAdd}><Plus aria-hidden="true" /> Add transaction</button></div></div>
      <div className="filter-bar"><label className="search-field"><Search aria-hidden="true" /><input aria-label="Search transactions" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search description, notes, tags…" /></label><label className="sr-only" htmlFor="category-filter">Filter by category</label><select id="category-filter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{data.categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select><label className="sr-only" htmlFor="method-filter">Filter by payment method</label><select id="method-filter" value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}><option value="all">All methods</option>{methods.map((method) => <option key={method} value={method}>{method}</option>)}</select><label className="sr-only" htmlFor="type-filter">Filter by transaction type</label><select id="type-filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All types</option><option value="expense">Expense</option><option value="income">Income</option></select></div>
      <div className="filter-bar date-filter-bar"><label className="date-field">From<input type="date" aria-label="Start date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label className="date-field">To<input type="date" aria-label="End date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label><label className="sort-field"><Filter aria-hidden="true" /><select aria-label="Sort transactions" value={sort} onChange={(event) => setSort(event.target.value)}><option value="date-desc">Newest first</option><option value="date-asc">Oldest first</option><option value="amount-desc">Highest amount</option><option value="amount-asc">Lowest amount</option></select></label></div>
      {visible.length ? <><div className="table-wrap"><table className="finance-table"><thead><tr><th scope="col">Transaction</th><th scope="col">Category</th><th scope="col">Date</th><th scope="col">Method / tags</th><th scope="col" className="amount-cell">Amount</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><div className="transaction-name"><strong>{item.title}</strong>{item.notes && <small>{item.notes}</small>}{item.receiptPath && <a className="receipt-link" href={`/api/receipts?pathname=${encodeURIComponent(item.receiptPath)}`} target="_blank" rel="noreferrer">View receipt</a>}</div></td><td><span className="category-chip">{item.category}</span></td><td>{displayDate(item.transactionDate, locale)}</td><td><span>{item.paymentMethod || '—'}</span>{item.tags?.length > 0 && <div className="tag-list">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}</td><td className={`amount-cell ${item.transactionType === 'income' ? 'income-amount' : ''}`}>{item.transactionType === 'income' ? '+' : '−'}{money(Number(item.amount), currency)}</td><td><div className="row-actions"><button aria-label={`Edit ${item.title}`} className="icon-button" onClick={() => edit(item)}><MoreHorizontal /></button><button aria-label={`Delete ${item.title}`} className="icon-button danger-icon" onClick={() => remove(item)}><Trash2 /></button></div></td></tr>)}</tbody></table></div><div className="pagination"><span>Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total}</span><div><button className="secondary-button compact-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button className="secondary-button compact-button" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</button></div></div></> : <EmptyState title="No matching transactions" copy="Try changing your filters, or add a transaction to get started." onClick={openAdd} />}
    </section><section className="panel import-panel"><div><p className="eyebrow">MOVE YOUR DATA</p><h2>Import transactions from CSV</h2><p className="panel-copy">Use columns for date, description, amount, category, type, payment method, and notes. Your import is limited to 1,000 rows at a time.</p></div><div className="import-controls"><input type="file" accept=".csv,text/csv" aria-label="Choose CSV file to import" onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)} /><button className="secondary-button" disabled={!csvFile || pending} onClick={importCsv}><FileUp aria-hidden="true" />{pending ? 'Importing…' : 'Import CSV'}</button></div></section></div>
}

function InsightsPanel({ data, items, currency }: { data: LedgerData; items: Expense[]; currency: string }) {
  const thisMonth = monthKey(new Date()); const lastMonthDate = new Date(); lastMonthDate.setMonth(lastMonthDate.getMonth() - 1); const lastMonth = monthKey(lastMonthDate)
  const categories = [...new Set(items.map((item) => item.category))]
  const stats = categories.map((name) => {
    const current = items.filter((item) => item.transactionType === 'expense' && item.category === name && monthKey(new Date(item.transactionDate)) === thisMonth).reduce((sum, item) => sum + Number(item.amount), 0)
    const previous = items.filter((item) => item.transactionType === 'expense' && item.category === name && monthKey(new Date(item.transactionDate)) === lastMonth).reduce((sum, item) => sum + Number(item.amount), 0)
    return { name, current, previous, change: previous ? Math.round((current - previous) / previous * 100) : null }
  }).sort((a, b) => b.current - a.current)
  const spentCurrent = items.filter((item) => item.transactionType === 'expense' && monthKey(new Date(item.transactionDate)) === thisMonth).reduce((sum, item) => sum + Number(item.amount), 0)
  const spentPrevious = items.filter((item) => item.transactionType === 'expense' && monthKey(new Date(item.transactionDate)) === lastMonth).reduce((sum, item) => sum + Number(item.amount), 0)
  return <div className="page-content"><section className="welcome-row"><div><p className="eyebrow">A CLOSER LOOK</p><h2>Patterns that help you plan.</h2><p>Compare your recent spending and find the categories moving most.</p></div></section><div className="metrics-grid two-metrics"><Metric label="This month" value={money(spentCurrent, currency)} icon={<ArrowUpRight />} tone="soft" note={`${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date())}`} /><Metric label="Last month" value={money(spentPrevious, currency)} icon={<CalendarDays />} tone="plain" note={`${new Intl.DateTimeFormat('en', { month: 'long' }).format(lastMonthDate)}`} /></div><SpendingCharts transactions={items} categories={data.categories} currency={currency} />
    {spentPrevious > 0 && <InsightCallout text={spentCurrent > spentPrevious ? `Overall spending is up ${Math.round((spentCurrent - spentPrevious) / spentPrevious * 100)}% compared with last month.` : `Overall spending is down ${Math.round((spentPrevious - spentCurrent) / spentPrevious * 100)}% compared with last month.`} />}
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">CATEGORY MOVEMENT</p><h2>What changed</h2></div></div><div className="insight-list">{stats.slice(0, 6).map((stat) => <div className="insight-row" key={stat.name}><span className="category-chip">{stat.name}</span><span>{money(stat.current, currency)} this month</span><span className={stat.change === null ? 'muted-text' : stat.change > 0 ? 'change-up' : 'change-down'}>{stat.change === null ? 'New this month' : `${stat.change > 0 ? '+' : ''}${stat.change}% vs last month`}</span><div className="insight-bar"><span style={{ width: `${Math.min(100, Math.max(3, spentCurrent ? stat.current / spentCurrent * 100 : 0))}%` }} /></div></div>)}</div>{!stats.length && <p className="empty-inline">Add a transaction to start building your insights.</p>}</section>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">TOP MERCHANTS</p><h2>Where you spend</h2></div></div><TopMerchants items={items} currency={currency} /></section></div>
}

function BudgetsPanel({ data, items, currency, budgetValue, setBudgetValue, categoryBudgetName, setCategoryBudgetName, categoryBudgetValue, setCategoryBudgetValue, run }: { data: LedgerData; items: Expense[]; currency: string; budgetValue: string; setBudgetValue: (value: string) => void; categoryBudgetName: string; setCategoryBudgetName: (value: string) => void; categoryBudgetValue: string; setCategoryBudgetValue: (value: string) => void; run: (task: () => Promise<unknown>, success: string) => void }) {
  const month = monthKey(new Date()); const currentExpenses = items.filter((item) => item.transactionType === 'expense' && monthKey(new Date(item.transactionDate)) === month)
  const spent = currentExpenses.reduce((sum, item) => sum + Number(item.amount), 0)
  const previousMonthDate = new Date(); previousMonthDate.setMonth(previousMonthDate.getMonth() - 1)
  const previousMonthKey = monthKey(previousMonthDate)
  const previousTotalSpent = items.filter((item) => item.transactionType === 'expense' && monthKey(new Date(item.transactionDate)) === previousMonthKey).reduce((sum, item) => sum + Number(item.amount), 0)
  const baseBudget = Number(data.budget.amount)
  const totalBudget = baseBudget + (data.budget.rollover ? Math.max(0, baseBudget - previousTotalSpent) : 0)
  const categoryBudgets = data.categories.map((category) => { const saved = data.categoryBudgets.find((budget) => budget.category === category.name); const priorSpent = items.filter((item) => item.transactionType === 'expense' && item.category === category.name && monthKey(new Date(item.transactionDate)) === previousMonthKey).reduce((sum, item) => sum + Number(item.amount), 0); const base = Number(saved?.amount ?? 0); return { category, amount: base + (saved?.rollover ? Math.max(0, base - priorSpent) : 0), spent: currentExpenses.filter((item) => item.category === category.name).reduce((sum, item) => sum + Number(item.amount), 0), rollover: saved?.rollover ?? false } })
  const [rollover, setRollover] = useState(data.budget.rollover)
  const [categoryRollover, setCategoryRollover] = useState(false)
  return <div className="page-content"><section className="welcome-row"><div><p className="eyebrow">MONTHLY PLANNING</p><h2>Give every dollar a direction.</h2><p>Track your total plan and set limits for the categories that matter most.</p></div></section><section className="panel budget-editor"><div className="panel-heading"><div><p className="eyebrow">OVERALL LIMIT</p><h2>Monthly budget</h2></div><span className="budget-status">{spent / Math.max(totalBudget, 1) >= 1 ? 'Over budget' : spent / Math.max(totalBudget, 1) >= 0.8 ? 'Near limit' : 'On track'}</span></div><div className="budget-total"><strong>{money(spent, currency)}</strong><span>spent of {money(totalBudget, currency)}</span></div><Progress value={spent / Math.max(totalBudget, 1) * 100} /><form className="budget-form" onSubmit={(event) => { event.preventDefault(); run(() => updateBudget(Number(budgetValue), rollover), 'Overall budget saved.') }}><label className="field">Monthly limit<input type="number" min="0.01" step="0.01" required value={budgetValue} onChange={(event) => setBudgetValue(event.target.value)} /></label><label className="check-field"><input type="checkbox" checked={rollover} onChange={(event) => setRollover(event.target.checked)} /> Roll over unused budget</label><button className="primary-button">Save overall budget</button></form></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">CATEGORY LIMITS</p><h2>Budgets by category</h2><p className="panel-copy">Amber at 80%, red when a category reaches its limit.</p></div></div><div className="category-budget-list">{categoryBudgets.map(({ category, amount: limit, spent: categorySpent, rollover: categoryRollover }) => { const ratio = limit ? categorySpent / limit * 100 : 0; return <div className="category-budget-row" key={category.id}><div className="inline-between"><div><strong>{category.name}</strong>{categoryRollover && <small className="rollover-badge">Rollover on</small>}</div><span>{money(categorySpent, currency)}{limit ? ` / ${money(limit, currency)}` : ' spent'}</span></div><Progress value={ratio} /><small className={ratio >= 100 ? 'change-up' : ratio >= 80 ? 'change-warn' : 'muted-text'}>{limit ? ratio >= 100 ? 'Budget reached' : ratio >= 80 ? `${Math.round(ratio)}% used — approaching limit` : `${Math.round(ratio)}% used` : 'No limit set'}</small></div> })}</div><form className="budget-form category-budget-form" onSubmit={(event) => { event.preventDefault(); run(() => updateCategoryBudget(categoryBudgetName, Number(categoryBudgetValue), categoryRollover), `${categoryBudgetName} budget saved.`); setCategoryBudgetValue('') }}><label className="field">Category<select value={categoryBudgetName} onChange={(event) => setCategoryBudgetName(event.target.value)}>{data.categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label><label className="field">Monthly limit<input type="number" min="0.01" step="0.01" required value={categoryBudgetValue} onChange={(event) => setCategoryBudgetValue(event.target.value)} placeholder="e.g. 250" /></label><label className="check-field"><input type="checkbox" checked={categoryRollover} onChange={(event) => setCategoryRollover(event.target.checked)} /> Roll over unused category budget</label><button className="primary-button"><Plus aria-hidden="true" /> Save category limit</button></form></section></div>
}

function SettingsPanel({ data, currency, run, exportBackup, csvFile, setCsvFile, importCsv, pending }: { data: LedgerData; currency: string; run: (task: () => Promise<unknown>, success: string) => void; exportBackup: () => void; csvFile: File | null; setCsvFile: (file: File | null) => void; importCsv: () => void; pending: boolean }) {
  const locale = data.preferences.dateFormat
  const [newCategoryName, setNewCategoryName] = useState(''); const [newCategoryColor, setNewCategoryColor] = useState('#6f9879'); const [newCategoryIcon, setNewCategoryIcon] = useState('Circle'); const [editingCategory, setEditingCategory] = useState<number | null>(null)
  const [accountName, setAccountName] = useState(''); const [accountKind, setAccountKind] = useState('cash'); const [openingBalance, setOpeningBalance] = useState('0'); const [transferFrom, setTransferFrom] = useState(''); const [transferTo, setTransferTo] = useState(''); const [transferAmount, setTransferAmount] = useState('');
  const [goalName, setGoalName] = useState(''); const [goalTarget, setGoalTarget] = useState(''); const [goalSaved, setGoalSaved] = useState('0'); const [goalDeadline, setGoalDeadline] = useState(''); const [goalContribution, setGoalContribution] = useState('25')
  const [recurringTitle, setRecurringTitle] = useState(''); const [recurringAmount, setRecurringAmount] = useState(''); const [recurringCategory, setRecurringCategory] = useState(data.categories[0]?.name ?? 'Bills'); const [recurringType, setRecurringType] = useState('expense'); const [recurringFrequency, setRecurringFrequency] = useState('monthly'); const [recurringDate, setRecurringDate] = useState(dayString(new Date())); const [recurringEnd, setRecurringEnd] = useState('');
  const [confirmReset, setConfirmReset] = useState(false)
  const themeMode = data.preferences.theme
  async function saveCategoryForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const id = editingCategory ?? undefined
    run(() => saveCategory({ id, name: newCategoryName, icon: newCategoryIcon, color: newCategoryColor }), id ? 'Category updated.' : 'Category added.')
    setEditingCategory(null); setNewCategoryName('')
  }
  return <div className="page-content settings-grid"><section className="panel settings-section"><div className="panel-heading"><div><p className="eyebrow">PERSONALIZE</p><h2>Preferences</h2><p className="panel-copy">Display preferences are saved to your account.</p></div></div><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); run(() => updatePreferences({ currency: String(form.get('currency')), dateFormat: String(form.get('dateFormat')), theme: String(form.get('theme')) }), 'Preferences saved.') }} className="settings-form"><label className="field">Display currency<select name="currency" defaultValue={currency}>{Object.entries(currencyNames).map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}</select></label><label className="field">Date format<select name="dateFormat" defaultValue={data.preferences.dateFormat}><option value="en-US">Month / day / year</option><option value="en-GB">Day / month / year</option></select></label><fieldset className="field theme-field"><legend>Appearance</legend><div className="theme-options">{[['light','Light',Sun],['dark','Dark',Moon],['system','System',Activity]].map(([value,label,Icon]) => { const IconComponent = Icon as typeof Sun; return <label key={value as string} className={`theme-option ${themeMode === value ? 'selected' : ''}`}><input type="radio" name="theme" value={value as string} defaultChecked={themeMode === value} onChange={(event) => { document.documentElement.dataset.theme = event.target.value }} /><IconComponent aria-hidden="true" /><span>{label as string}</span></label> })}</div></fieldset><button className="primary-button">Save preferences</button></form></section>
    <section className="panel settings-section"><div className="panel-heading"><div><p className="eyebrow">ORGANIZE</p><h2>Categories</h2><p className="panel-copy">Edit the six presets or create your own categories.</p></div></div><div className="category-manage-list">{data.categories.map((category) => <div className="category-manage-row" key={category.id}><span className="category-symbol" style={{ background: category.color }}><CategoryGlyph name={category.icon} /></span><span>{category.name}{category.isDefault && <small>Preset</small>}</span><button className="text-button" onClick={() => { setEditingCategory(category.id); setNewCategoryName(category.name); setNewCategoryColor(category.color); setNewCategoryIcon(category.icon) }}>Edit</button>{!category.isDefault && <button className="icon-button danger-icon" aria-label={`Delete ${category.name}`} onClick={() => run(() => deleteCategory(category.id), 'Category deleted.')}><Trash2 /></button>}</div>)}</div><form onSubmit={saveCategoryForm} className="settings-form inline-settings-form"><label className="field">{editingCategory ? 'Edit category name' : 'New category'}<input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} maxLength={40} required placeholder="e.g. Education" /></label><label className="field">Icon<select value={newCategoryIcon} onChange={(event) => setNewCategoryIcon(event.target.value)}><option value="Circle">General</option><option value="Utensils">Food</option><option value="CarFront">Transport</option><option value="ShoppingBag">Shopping</option><option value="House">Home</option><option value="HeartPulse">Health</option></select></label><label className="field color-field">Color<input type="color" value={newCategoryColor} onChange={(event) => setNewCategoryColor(event.target.value)} /></label><div className="button-row"><button className="primary-button"><Plus aria-hidden="true" />{editingCategory ? 'Save category' : 'Add category'}</button>{editingCategory && <button type="button" className="secondary-button" onClick={() => { setEditingCategory(null); setNewCategoryName('') }}>Cancel</button>}</div></form></section>
    <section className="panel settings-section"><div className="panel-heading"><div><p className="eyebrow">ACCOUNTS</p><h2>Money locations</h2><p className="panel-copy">Transfers stay separate from spending so they don&apos;t distort your reports.</p></div></div><div className="managed-list">{data.accounts.map((account) => <div key={account.id} className="managed-row"><div><strong>{account.name}</strong><small>{account.kind} · {money(account.balance, account.currency || currency)}</small></div><button className="icon-button danger-icon" aria-label={`Delete ${account.name}`} onClick={() => run(() => deleteAccount(account.id), 'Account deleted.')}><Trash2 /></button></div>)}</div><form className="settings-form" onSubmit={(event) => { event.preventDefault(); run(() => saveAccount({ name: accountName, kind: accountKind, currency, openingBalance: Number(openingBalance) }), 'Account added.'); setAccountName('') }}><label className="field">Account name<input required maxLength={60} value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="e.g. Travel fund" /></label><label className="field">Type<select value={accountKind} onChange={(event) => setAccountKind(event.target.value)}><option value="cash">Cash</option><option value="bank">Bank</option><option value="card">Card</option><option value="investment">Investment</option><option value="other">Other</option></select></label><label className="field">Opening balance<input type="number" step="0.01" min="0" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} /></label><button className="secondary-button"><Plus aria-hidden="true" /> Add account</button></form><form className="transfer-form" onSubmit={(event) => { event.preventDefault(); run(() => transferBetweenAccounts({ fromAccountId: Number(transferFrom), toAccountId: Number(transferTo), amount: Number(transferAmount), date: dayString(new Date()) }), 'Transfer recorded.'); setTransferAmount('') }}><p className="field-label">Move money between accounts</p><div className="transfer-fields"><select required aria-label="From account" value={transferFrom} onChange={(event) => setTransferFrom(event.target.value)}><option value="">From</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><ArrowLeftRight aria-hidden="true" /><select required aria-label="To account" value={transferTo} onChange={(event) => setTransferTo(event.target.value)}><option value="">To</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><input required aria-label="Transfer amount" type="number" min="0.01" step="0.01" placeholder="Amount" value={transferAmount} onChange={(event) => setTransferAmount(event.target.value)} /><button className="secondary-button">Transfer</button></div></form></section>
    <section className="panel settings-section"><div className="panel-heading"><div><p className="eyebrow">SAVE TOWARD SOMETHING</p><h2>Savings goals</h2></div></div><div className="managed-list">{data.goals.map((goal) => <div className="managed-row goal-managed-row" key={goal.id}><span className="goal-ring small-goal-ring" style={{ '--goal-progress': `${Math.min(100, Number(goal.savedAmount) / Number(goal.targetAmount) * 100)}%` } as React.CSSProperties}><span>{Math.round(Number(goal.savedAmount) / Number(goal.targetAmount) * 100)}%</span></span><div><strong>{goal.name}</strong><small>{money(Number(goal.savedAmount), currency)} of {money(Number(goal.targetAmount), currency)}{goal.deadline ? ` · by ${displayDate(`${goal.deadline}T00:00:00`, locale)}` : ''}</small></div><div className="goal-contribution"><input aria-label={`Contribution amount for ${goal.name}`} type="number" min="0.01" step="0.01" value={goalContribution} onChange={(event) => setGoalContribution(event.target.value)} /><button className="text-button" onClick={() => run(() => contributeToGoal(goal.id, Number(goalContribution)), 'Savings progress updated.')}>Add</button></div><button className="icon-button danger-icon" aria-label={`Delete goal ${goal.name}`} onClick={() => run(() => deleteGoal(goal.id), 'Goal deleted.')}><Trash2 /></button></div>)}</div><form className="settings-form" onSubmit={(event) => { event.preventDefault(); run(() => saveGoal({ name: goalName, targetAmount: Number(goalTarget), savedAmount: Number(goalSaved), deadline: goalDeadline || undefined }), 'Savings goal created.'); setGoalName(''); setGoalTarget('') }}><label className="field">Goal name<input required value={goalName} onChange={(event) => setGoalName(event.target.value)} placeholder="e.g. New laptop" /></label><label className="field">Target amount<input required type="number" min="0.01" step="0.01" value={goalTarget} onChange={(event) => setGoalTarget(event.target.value)} /></label><label className="field">Already saved<input type="number" min="0" step="0.01" value={goalSaved} onChange={(event) => setGoalSaved(event.target.value)} /></label><label className="field">Target date<input type="date" value={goalDeadline} onChange={(event) => setGoalDeadline(event.target.value)} /></label><button className="secondary-button"><Plus aria-hidden="true" /> Create goal</button></form></section>
    <section className="panel settings-section"><div className="panel-heading"><div><p className="eyebrow">AUTOMATE</p><h2>Recurring transactions</h2><p className="panel-copy">Bills and income are added automatically when due. Upcoming items appear on Overview.</p></div></div><div className="managed-list">{data.schedules.map((schedule) => <div key={schedule.id} className="managed-row"><div><strong>{schedule.title}</strong><small>{schedule.frequency} · next {displayDate(`${schedule.nextDue}T00:00:00`, locale)} · {money(Number(schedule.amount), currency)}</small></div><button className="icon-button danger-icon" aria-label={`Stop recurring ${schedule.title}`} onClick={() => run(() => deleteRecurring(schedule.id), 'Recurring schedule paused.')}><X /></button></div>)}</div><form className="settings-form recurring-form" onSubmit={(event) => { event.preventDefault(); run(() => saveRecurring({ title: recurringTitle, amount: Number(recurringAmount), category: recurringCategory, transactionType: recurringType, frequency: recurringFrequency, startsOn: recurringDate, endsOn: recurringEnd || undefined }), 'Recurring transaction saved.'); setRecurringTitle(''); setRecurringAmount('') }}><label className="field">Bill or income<input required value={recurringTitle} onChange={(event) => setRecurringTitle(event.target.value)} placeholder="e.g. Rent" /></label><label className="field">Amount<input required type="number" min="0.01" step="0.01" value={recurringAmount} onChange={(event) => setRecurringAmount(event.target.value)} /></label><label className="field">Type<select value={recurringType} onChange={(event) => setRecurringType(event.target.value)}><option value="expense">Expense</option><option value="income">Income</option></select></label><label className="field">Category<select value={recurringCategory} onChange={(event) => setRecurringCategory(event.target.value)}>{data.categories.map((category) => <option key={category.id}>{category.name}</option>)}</select></label><label className="field">Repeats<select value={recurringFrequency} onChange={(event) => setRecurringFrequency(event.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label><label className="field">First date<input required type="date" value={recurringDate} onChange={(event) => setRecurringDate(event.target.value)} /></label><label className="field">End date (optional)<input type="date" min={recurringDate} value={recurringEnd} onChange={(event) => setRecurringEnd(event.target.value)} /></label><button className="secondary-button"><Plus aria-hidden="true" /> Add recurring</button></form></section>
    <section className="panel settings-section"><div className="panel-heading"><div><p className="eyebrow">YOUR DATA</p><h2>Import & backup</h2><p className="panel-copy">Export all of your data in one portable JSON file, or import transaction rows from CSV.</p></div><button className="secondary-button" onClick={exportBackup}><Download aria-hidden="true" /> Download backup</button></div><div className="import-controls"><input type="file" accept=".csv,text/csv" aria-label="Choose CSV to import" onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)} /><button className="secondary-button" disabled={!csvFile || pending} onClick={importCsv}><FileUp aria-hidden="true" /> Import transactions</button><button className="text-button" onClick={() => { void loadDemoData().then(() => location.reload()).catch((cause) => alert(cause instanceof Error ? cause.message : 'Could not load demo data.')) }}>Load demo data</button></div></section>
    <section className="panel settings-section reset-section"><div><p className="eyebrow">DESTRUCTIVE ACTION</p><h2>Reset all data</h2><p className="panel-copy">Remove your transactions, budgets, categories, accounts, transfers, goals, and recurring schedules. This cannot be undone.</p></div>{confirmReset ? <div className="button-row"><button className="danger-button" onClick={() => { run(() => resetAllData(), 'Your Ledger has been reset.'); setConfirmReset(false) }}>Yes, reset my data</button><button className="secondary-button" onClick={() => setConfirmReset(false)}>Cancel</button></div> : <button className="danger-outline-button" onClick={() => setConfirmReset(true)}>Reset all data</button>}</section>
  </div>
}

function ReportsPanel({ data, items, currency, exportCsv, exportBackup }: { data: LedgerData; items: Expense[]; currency: string; exportCsv: () => void; exportBackup: () => void }) {
  const now = new Date(); const key = monthKey(now); const period = items.filter((item) => item.transactionType === 'expense' && monthKey(new Date(item.transactionDate)) === key); const total = period.reduce((sum, item) => sum + Number(item.amount), 0)
  const categoryTotals = data.categories.map((category) => ({ name: category.name, amount: period.filter((item) => item.category === category.name).reduce((sum, item) => sum + Number(item.amount), 0) })).filter((row) => row.amount > 0).sort((a, b) => b.amount - a.amount)
  return <div className="page-content reports-page"><section className="report-title"><div><p className="eyebrow">{new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(now).toUpperCase()}</p><h2>Monthly financial summary</h2><p>Prepared privately for your Ledger account.</p></div><div className="button-row no-print"><button className="secondary-button" onClick={exportCsv}><Download aria-hidden="true" /> Download CSV</button><button className="primary-button" onClick={() => window.print()}><Printer aria-hidden="true" /> Save as PDF</button></div></section><div className="report-highlight"><p>Total spending</p><strong>{money(total, currency)}</strong><span>{period.length} expense transactions</span></div><section className="panel"><div className="panel-heading"><div><p className="eyebrow">BREAKDOWN</p><h2>Spend by category</h2></div></div>{categoryTotals.length ? <div className="report-category-list">{categoryTotals.map((row) => <div key={row.name}><span>{row.name}</span><div className="report-bar"><span style={{ width: `${total ? row.amount / total * 100 : 0}%` }} /></div><strong>{money(row.amount, currency)}</strong></div>)}</div> : <p className="empty-inline">No expenses recorded this month.</p>}</section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">SUMMARY</p><h2>Cash flow & planning</h2></div></div><div className="report-summary-grid"><div><small>Monthly budget</small><strong>{money(Number(data.budget.amount), currency)}</strong></div><div><small>Budget used</small><strong>{Number(data.budget.amount) ? `${Math.round(total / Number(data.budget.amount) * 100)}%` : '—'}</strong></div><div><small>Transactions</small><strong>{items.length}</strong></div><div><small>Savings goals</small><strong>{data.goals.length}</strong></div></div></section><div className="panel backup-note"><div><h3>Need a full copy?</h3><p>Download a JSON backup with your accounts, goals, categories, and recurring schedules.</p></div><button className="secondary-button no-print" onClick={exportBackup}><Download aria-hidden="true" /> Download backup</button></div></div>
}

function CategoryGlyph({ name }: { name: string }) { const icons: Record<string, typeof Circle> = { Circle, Utensils, CarFront, ShoppingBag, House, HeartPulse }; const Icon = icons[name] ?? Circle; return <Icon aria-hidden="true" /> }
function Metric({ label, value, icon, tone, note }: { label: string; value: string; icon: React.ReactNode; tone: string; note: string }) { return <article className={`metric-card metric-${tone}`}><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong className="metric-value">{value}</strong><small>{note}</small></article> }
function Progress({ value }: { value: number }) { return <div className={`progress-track ${value >= 100 ? 'is-over' : value >= 80 ? 'is-warn' : ''}`} role="progressbar" aria-label="Budget usage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(value))}><span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div> }
function EmptyState({ title, copy, onClick }: { title: string; copy: string; onClick: () => void }) { return <div className="empty-state"><span className="empty-icon"><Wallet aria-hidden="true" /></span><h3>{title}</h3><p>{copy}</p><button className="secondary-button" onClick={onClick}><Plus aria-hidden="true" /> Add transaction</button></div> }
function TransactionRow({ item, currency, locale, compact = false }: { item: Expense; currency: string; locale: string; compact?: boolean }) { return <div className="recent-row"><span className={`transaction-dot ${item.transactionType === 'income' ? 'income-dot' : ''}`} aria-hidden="true">{item.transactionType === 'income' ? <ArrowDownLeft /> : <ArrowUpRight />}</span><span className="recent-title"><strong>{item.title}</strong><small>{item.category}{!compact && ` · ${displayDate(item.transactionDate, locale)}`}</small></span><strong className={item.transactionType === 'income' ? 'income-amount' : ''}>{item.transactionType === 'income' ? '+' : '−'}{money(Number(item.amount), currency)}</strong></div> }
function InsightCallout({ text }: { text: string }) { return <div className="insight-callout"><span><Sparkles aria-hidden="true" /></span><p><strong>A small insight</strong>{text}</p></div> }
function TopMerchants({ items, currency }: { items: Expense[]; currency: string }) { const ranks = Object.entries(items.filter((item) => item.transactionType === 'expense').reduce<Record<string, number>>((map, item) => { map[item.title] = (map[item.title] ?? 0) + Number(item.amount); return map }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5); return ranks.length ? <div className="top-merchants">{ranks.map(([name, value], index) => <div className="merchant-row" key={name}><span className="merchant-rank">0{index + 1}</span><strong>{name}</strong><b>{money(value, currency)}</b></div>)}</div> : <p className="empty-inline">Your top merchants will appear as you add transactions.</p> }
function csvCell(value: unknown) { const text = String(value ?? ''); const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll('"', '""')}"` }
function downloadFile(name: string, content: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url) }
function parseCsv(source: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false
  for (let index = 0; index < source.length; index++) { const char = source[index]; if (quoted) { if (char === '"' && source[index + 1] === '"') { cell += '"'; index++ } else if (char === '"') quoted = false; else cell += char } else if (char === '"') quoted = true; else if (char === ',') { row.push(cell); cell = '' } else if (char === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = '' } else cell += char }
  if (quoted) throw new Error('This CSV has an unfinished quoted field.')
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row) }
  const headers = rows.shift()?.map((header) => header.trim().toLowerCase().replaceAll(' ', '_')) ?? []
  const titleIndex = headers.findIndex((header) => ['description','title','merchant','name'].includes(header)); const amountIndex = headers.indexOf('amount'); const categoryIndex = headers.indexOf('category')
  if (titleIndex < 0 || amountIndex < 0 || categoryIndex < 0) throw new Error('CSV must include description (or title), amount, and category columns.')
  if (rows.length > 1000) throw new Error('Import up to 1,000 rows at a time.')
  return rows.filter((values) => values.some((value) => value.trim())).map((values) => {
    const date = values[headers.indexOf('date')] || values[headers.indexOf('transaction_date')] || dayString(new Date())
    const rawAmount = Number(values[amountIndex]?.replace(/[,$]/g, ''))
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) throw new Error('Every CSV row needs a positive amount.')
    const rawType = values[headers.indexOf('type')] || values[headers.indexOf('transaction_type')] || 'expense'
    const method = values[headers.indexOf('payment_method')] || values[headers.indexOf('method')] || ''
    const notes = values[headers.indexOf('notes')] || ''
    return { title: values[titleIndex], amount: rawAmount, category: values[categoryIndex], transactionType: rawType.toLowerCase() === 'income' ? 'income' : 'expense', transactionDate: date, paymentMethod: method, notes }
  })
}

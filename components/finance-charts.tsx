'use client'

import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { Expense } from '@/lib/db/schema'
import type { getLedgerData } from '@/app/actions/expenses'

type FinanceCategory = Awaited<ReturnType<typeof getLedgerData>>['categories'][number]
const chartColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-2)']
const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)

export function SpendingCharts({ transactions, categories, currency }: { transactions: Expense[]; categories: FinanceCategory[]; currency: string }) {
  const today = new Date()
  const months = Array.from({ length: 6 }, (_, index) => new Date(today.getFullYear(), today.getMonth() - 5 + index, 1))
  const trend = months.map((month) => {
    const total = transactions.filter((item) => {
      const date = new Date(item.transactionDate)
      return item.transactionType === 'expense' && date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
    }).reduce((sum, item) => sum + Number(item.amount), 0)
    return { month: new Intl.DateTimeFormat('en', { month: 'short' }).format(month), spending: total }
  })
  const config: ChartConfig = { spending: { label: 'Spending', color: 'var(--chart-2)' } }
  const current = transactions.filter((item) => {
    const date = new Date(item.transactionDate)
    return item.transactionType === 'expense' && date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth()
  })
  const categoryData = categories.map((category, index) => ({
    name: category.name,
    key: `category${index}`,
    value: current.filter((item) => item.category === category.name).reduce((sum, item) => sum + Number(item.amount), 0),
    color: chartColors[index % chartColors.length],
  })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value)
  const categoryConfig: ChartConfig = Object.fromEntries(categoryData.map((item) => [item.key, { label: item.name, color: item.color }]))

  return <div className="chart-grid">
    <section className="panel chart-panel" aria-labelledby="trend-heading">
      <div className="panel-heading"><div><p className="eyebrow">SIX MONTHS</p><h2 id="trend-heading">Spending trend</h2></div><span className="subtle-label">Monthly outflow</span></div>
      {trend.some((item) => item.spending > 0) ? <ChartContainer config={config} className="h-[240px] w-full">
        <AreaChart data={trend} margin={{ left: 4, right: 12, top: 12 }}>
          <defs><linearGradient id="spend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-spending)" stopOpacity={0.22} /><stop offset="95%" stopColor="var(--color-spending)" stopOpacity={0.02} /></linearGradient></defs>
          <CartesianGrid vertical={false} strokeDasharray="4 5" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={(value: number) => money(value, currency)} width={62} />
          <Tooltip content={<ChartTooltipContent formatter={(value) => money(Number(value), currency)} />} />
          <Area dataKey="spending" type="monotone" stroke="var(--color-spending)" fill="url(#spend-fill)" strokeWidth={2.5} activeDot={{ r: 4 }} />
        </AreaChart>
      </ChartContainer> : <div className="chart-empty">Your spending trend will appear after your first transaction.</div>}
    </section>
    <section className="panel chart-panel" aria-labelledby="category-heading">
      <div className="panel-heading"><div><p className="eyebrow">THIS MONTH</p><h2 id="category-heading">By category</h2></div></div>
      {categoryData.length ? <div className="donut-wrap">
        <ChartContainer config={categoryConfig} className="h-[220px] w-[220px] shrink-0">
          <PieChart><Pie data={categoryData} dataKey="value" nameKey="key" innerRadius={64} outerRadius={94} paddingAngle={3} strokeWidth={0}>
            {categoryData.map((entry) => <Cell key={entry.key} fill={`var(--color-${entry.key})`} />)}
          </Pie><Tooltip content={<ChartTooltipContent formatter={(value) => money(Number(value), currency)} hideLabel />} /></PieChart>
        </ChartContainer>
        <ul className="donut-legend">{categoryData.slice(0, 5).map((item) => <li key={item.key}><span className="legend-dot" style={{ backgroundColor: item.color }} /><span className="legend-name">{item.name}</span><strong>{money(item.value, currency)}</strong></li>)}</ul>
      </div> : <div className="chart-empty">Add an expense to see how your spending is distributed.</div>}
    </section>
  </div>
}

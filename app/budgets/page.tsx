import { LedgerPage } from '@/components/ledger-page'

export default function BudgetsPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) { return <LedgerPage activePage="budgets" searchParams={searchParams} /> }

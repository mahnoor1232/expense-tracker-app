import { LedgerPage } from '@/components/ledger-page'

export default function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) { return <LedgerPage activePage="reports" searchParams={searchParams} /> }

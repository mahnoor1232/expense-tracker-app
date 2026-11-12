import { LedgerPage } from '@/components/ledger-page'

export default function InsightsPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) { return <LedgerPage activePage="insights" searchParams={searchParams} /> }

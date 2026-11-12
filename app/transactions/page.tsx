import { LedgerPage } from '@/components/ledger-page'

export default function TransactionsPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) { return <LedgerPage activePage="transactions" searchParams={searchParams} /> }

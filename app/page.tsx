import { LedgerPage } from '@/components/ledger-page'

export default function Page({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) { return <LedgerPage activePage="overview" searchParams={searchParams} /> }

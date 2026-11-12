import { LedgerPage } from '@/components/ledger-page'

export default function SettingsPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) { return <LedgerPage activePage="settings" searchParams={searchParams} /> }

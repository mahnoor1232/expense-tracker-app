export default function Loading() {
  return <main className="ledger-app loading-screen" aria-label="Loading Ledger" aria-busy="true">
    <div className="loading-sidebar"><span className="skeleton-block brand-skeleton" /><span className="skeleton-block nav-skeleton" /><span className="skeleton-block nav-skeleton" /><span className="skeleton-block nav-skeleton" /></div>
    <section className="loading-content"><span className="skeleton-block title-skeleton" /><div className="skeleton-metrics">{[1, 2, 3, 4].map((item) => <span className="skeleton-block metric-skeleton" key={item} />)}</div><span className="skeleton-block chart-skeleton" /><div className="skeleton-metrics"><span className="skeleton-block list-skeleton" /><span className="skeleton-block list-skeleton" /></div><span className="sr-only">Loading your accounts and transactions…</span></section>
  </main>
}

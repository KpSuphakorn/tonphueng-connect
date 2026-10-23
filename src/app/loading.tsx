/** Instant route feedback while server data loads; nested routes re-export this skeleton. */
export default function Loading() {
  return <main className="page-wrap" aria-busy="true">
    <p role="status" className="form-help">กำลังโหลด…</p>
    <div className="skeleton skeleton-title" />
    <div className="skeleton" />
    <div className="skeleton" />
    <div className="skeleton" />
  </main>;
}

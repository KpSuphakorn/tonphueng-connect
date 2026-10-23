/** Instant route feedback while server data loads; nested routes re-export this skeleton. */
export default function Loading() {
  return <main className="page-wrap no-nav" aria-busy="true">
    <p role="status" className="visually-hidden">กำลังโหลด…</p>
    <div className="skeleton skeleton-header" />
    <div className="skeleton skeleton-title" />
    <div className="skeleton skeleton-media" />
    <div className="skeleton" />
    <div className="skeleton" />
  </main>;
}

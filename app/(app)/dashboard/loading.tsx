export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="h-9 w-48 animate-pulse rounded-lg bg-card" />

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-8 w-40 animate-pulse rounded-lg bg-card" />
          <div className="mt-2 h-4 w-56 animate-pulse rounded bg-card" />
        </div>
        <div className="h-10 w-44 animate-pulse rounded-lg bg-card" />
      </div>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li
            key={i}
            className="rounded-xl border border-border-subtle bg-card p-5"
          >
            <div className="h-24 w-full animate-pulse rounded-lg bg-canvas" />
            <div className="mt-4 h-5 w-3/4 animate-pulse rounded bg-canvas" />
            <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-canvas" />
          </li>
        ))}
      </ul>

      <div className="mt-8 h-14 animate-pulse rounded-xl border border-border-subtle bg-surface/50" />
    </main>
  );
}

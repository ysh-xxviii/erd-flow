export default function DiagramLoading() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full">
      {/* sidebar skeleton */}
      <aside className="hidden w-72 flex-col border-r border-border-subtle bg-surface p-4 sm:flex">
        <div className="h-6 w-32 animate-pulse rounded bg-card" />
        <div className="mt-4 h-9 w-full animate-pulse rounded-lg bg-card" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-full animate-pulse rounded-lg bg-card"
            />
          ))}
        </div>
      </aside>

      {/* canvas skeleton */}
      <div className="relative flex-1 overflow-hidden bg-canvas">
        <div className="absolute left-4 top-4 h-8 w-28 animate-pulse rounded-lg bg-card" />
        <div className="absolute right-4 top-4 flex gap-2">
          <div className="h-8 w-24 animate-pulse rounded-lg bg-card" />
          <div className="h-8 w-20 animate-pulse rounded-lg bg-card" />
        </div>

        <div className="flex h-full w-full items-center justify-center">
          <div className="flex items-center gap-3 text-ink-faint">
            <svg
              className="h-5 w-5 animate-spin text-accent-blue"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z"
              />
            </svg>
            <span className="text-sm">Loading diagram…</span>
          </div>
        </div>
      </div>
    </div>
  );
}

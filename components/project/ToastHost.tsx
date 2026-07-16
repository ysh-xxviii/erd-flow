"use client";

import { usePendingChanges } from "@/lib/pendingChanges";

export function ToastHost() {
  const { toasts, dismissToast } = usePendingChanges();
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-16 right-4 z-[120] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto rounded-md border border-[#2E333D] bg-[#1A1D23] px-3 py-2 shadow-xl"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-[#E7EAF0]">{t.title}</p>
              {t.detail && (
                <p className="mt-0.5 text-xs text-[#9AA3B2]">{t.detail}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="cursor-pointer text-[#646D7E] hover:text-[#E7EAF0]"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

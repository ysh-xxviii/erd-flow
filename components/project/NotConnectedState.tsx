"use client";

import { useProjectStore } from "@/lib/projectStore";

export function NotConnectedState({
  title = "Not connected",
  detail = "Connect a repo and database to unlock this panel.",
}: {
  title?: string;
  detail?: string;
}) {
  const { setModal } = useProjectStore();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2E333D] bg-[#1A1D23] text-[#4EB3A5]">
        ⌁
      </div>
      <h3 className="text-sm font-semibold text-[#E7EAF0]">{title}</h3>
      <p className="max-w-xs text-xs text-[#9AA3B2]">{detail}</p>
      <button
        type="button"
        onClick={() => setModal("connect")}
        className="cursor-pointer rounded-md bg-[#6E9BF5] px-3 py-1.5 text-sm font-semibold text-[#111318]"
      >
        Connect
      </button>
    </div>
  );
}

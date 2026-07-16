"use client";

import { useEffect, useState } from "react";
import type { ApiRequest, ErdTable } from "@/lib/types";
import { listRequests } from "@/lib/apiTesting";
import { useProjectStore } from "@/lib/projectStore";
import { Inspector } from "./Inspector";

export function FrontendSection({
  diagramId,
  tables,
  diagramName,
}: {
  diagramId: string;
  tables: ErdTable[];
  diagramName: string;
}) {
  const { setActiveSection, setBackendTab, setSelectedTableId } =
    useProjectStore();
  const [requests, setRequests] = useState<ApiRequest[]>([]);

  useEffect(() => {
    void listRequests(diagramId).then(setRequests).catch(() => setRequests([]));
  }, [diagramId]);

  const html = `<!DOCTYPE html><html><head><style>
    body{font-family:system-ui;background:#111318;color:#E7EAF0;margin:0;padding:24px}
    h1{font-size:18px;margin:0 0 8px} p{color:#9AA3B2;font-size:13px}
    .card{border:1px solid #2E333D;border-radius:6px;padding:12px;margin-top:12px;background:#15181E}
    .m{font-family:monospace;font-size:11px;color:#3FB27F}
  </style></head><body>
    <h1>${diagramName} — preview</h1>
    <p>Demo site chrome. Pages map to API calls below.</p>
    ${requests
      .slice(0, 8)
      .map(
        (r) =>
          `<div class="card"><div class="m">${r.method}</div><div>${r.name}</div></div>`
      )
      .join("")}
  </body></html>`;

  return (
    <div className="flex h-full min-w-0 flex-1">
      <aside className="flex w-[248px] flex-none flex-col border-r border-[#2E333D] bg-[#15181E]">
        <div className="border-b border-[#2E333D] px-3 py-2.5 text-[10px] uppercase text-[#646D7E]">
          Pages
        </div>
        {["Home", "Dashboard", "Settings"].map((p) => (
          <button
            key={p}
            type="button"
            className="px-3 py-2 text-left text-xs text-[#9AA3B2] hover:bg-[#1A1D23]"
          >
            {p}
          </button>
        ))}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[#111318] p-4">
        <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-[#2E333D] bg-[#15181E]">
          <div className="flex items-center gap-2 border-b border-[#2E333D] px-3 py-2">
            <span className="flex gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[#C25E5E]/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#D9A03F]/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#3FB27F]/80" />
            </span>
            <div className="flex-1 truncate rounded bg-[#111318] px-2 py-1 font-mono text-[10px] text-[#646D7E]">
              https://app.local/preview
            </div>
          </div>
          <iframe
            title="Frontend preview"
            sandbox=""
            srcDoc={html}
            className="min-h-0 flex-1 w-full border-0 bg-[#111318]"
          />
        </div>
      </div>

      <Inspector title="Home" breadcrumb="Frontend / Page">
        <p className="mb-2 text-[10px] uppercase text-[#646D7E]">API calls</p>
        <ul className="space-y-2">
          {requests.slice(0, 6).map((r) => (
            <li key={r.id} className="text-xs text-[#9AA3B2]">
              <span className="font-mono text-[#3FB27F]">{r.method}</span>{" "}
              {r.name}
              {r.table_id && (
                <button
                  type="button"
                  className="ml-1 cursor-pointer text-[#4EB3A5]"
                  onClick={() => {
                    const t = tables.find((x) => x.id === r.table_id);
                    if (t) {
                      setSelectedTableId(t.id);
                      setActiveSection("backend");
                      setBackendTab("schemas");
                    }
                  }}
                >
                  ⌗{tables.find((t) => t.id === r.table_id)?.name ?? "table"}
                </button>
              )}
            </li>
          ))}
          {requests.length === 0 && (
            <li className="text-xs text-[#646D7E]">No endpoints yet</li>
          )}
        </ul>
      </Inspector>
    </div>
  );
}

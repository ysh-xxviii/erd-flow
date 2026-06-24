import { Fragment, type ReactNode } from "react";

const KEY = "#8b7bff";
const STR = "#1bb38c";
const NUM = "#e3b341";
const BOOL = "#ef8a52";
const PUN = "#5e6a85";

const TOKEN =
  /("(?:[^"\\]|\\.)*")(\s*:)?|(\btrue\b|\bfalse\b|\bnull\b)|(-?\d+\.?\d*)|([{}\[\],])/g;

function highlightLine(line: string) {
  const parts: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(line))) {
    if (m.index > last) {
      parts.push(<Fragment key={k++}>{line.slice(last, m.index)}</Fragment>);
    }
    if (m[1]) {
      const isKey = !!m[2];
      parts.push(
        <span key={k++} style={{ color: isKey ? KEY : STR }}>
          {m[1]}
        </span>
      );
      if (m[2]) {
        parts.push(
          <span key={k++} style={{ color: PUN }}>
            {m[2]}
          </span>
        );
      }
    } else if (m[3]) {
      parts.push(
        <span key={k++} style={{ color: BOOL }}>
          {m[3]}
        </span>
      );
    } else if (m[4]) {
      parts.push(
        <span key={k++} style={{ color: NUM }}>
          {m[4]}
        </span>
      );
    } else if (m[5]) {
      parts.push(
        <span key={k++} style={{ color: PUN }}>
          {m[5]}
        </span>
      );
    }
    last = TOKEN.lastIndex;
  }
  if (last < line.length) {
    parts.push(<Fragment key={k++}>{line.slice(last)}</Fragment>);
  }
  TOKEN.lastIndex = 0;
  return parts;
}

export function HighlightedJson({ source }: { source: string }) {
  const text = source.trim() || "{}";
  const lines = text.split("\n");

  return (
    <code
      className="block font-mono text-[12px] leading-[1.65] text-[#cdd7ec]"
      style={{ fontFamily: "var(--font-jetbrains), ui-monospace, monospace" }}
    >
      {lines.map((line, i) => (
        <div key={i} className="min-h-[1.2em] whitespace-pre">
          {highlightLine(line)}
        </div>
      ))}
    </code>
  );
}

export function formatJsonSchema(raw: string | null | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) return "{}";
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return trimmed;
  }
}

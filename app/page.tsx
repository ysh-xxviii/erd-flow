import Link from "next/link";
import { BrandLogo } from "@/components/Brand";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 40% at 12% 0%, rgba(90,166,255,0.16), transparent 70%), radial-gradient(45% 45% at 92% 100%, rgba(139,123,255,0.14), transparent 70%)",
        }}
      />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <BrandLogo />
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="cursor-pointer rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-[#79b6ff]"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-24 pt-10 sm:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left: copy */}
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface/60 px-3 py-1 text-xs font-medium text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-green" />
              AI-assisted database design
            </span>

            <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Design your database{" "}
              <span className="bg-gradient-to-r from-accent-blue via-accent-purple to-accent-orange bg-clip-text text-transparent">
                visually
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg lg:mx-0">
              Define your tables, let AI recommend the related tables you
              forgot, and watch them snap into a clean entity-relationship
              diagram. Every user gets their own multi-tenant workspace.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                href="/signup"
                className="w-full cursor-pointer rounded-lg bg-accent-blue px-6 py-3 text-center text-sm font-semibold text-canvas transition-colors hover:bg-[#79b6ff] sm:w-auto"
              >
                Start building free
              </Link>
              <Link
                href="/login"
                className="w-full cursor-pointer rounded-lg border border-border-subtle px-6 py-3 text-center text-sm font-semibold text-ink transition-colors hover:bg-surface sm:w-auto"
              >
                I already have an account
              </Link>
            </div>
          </div>

          {/* Right: ERD preview */}
          <div className="relative">
            <ErdPreview />
          </div>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-3">
          <Feature
            color="#5aa6ff"
            title="Visual ERD canvas"
            body="Drag color-coded entity cards, connect foreign keys, and see your whole schema at a glance."
          />
          <Feature
            color="#8b7bff"
            title="AI suggestions"
            body="Describe your app or add a few tables — get recommended tables, columns, and relations."
          />
          <Feature
            color="#ef8a52"
            title="Multi-tenant workspaces"
            body="Your data is isolated in your own workspace, secured with row-level access control."
          />
        </div>
      </main>
    </div>
  );
}

function ErdPreview() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border-subtle bg-canvas p-6 shadow-2xl"
      style={{
        backgroundImage:
          "radial-gradient(rgba(31,41,64,0.9) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      <svg
        viewBox="0 0 460 320"
        className="h-auto w-full"
        role="img"
        aria-label="Example entity relationship diagram with users, projects and tasks tables"
      >
        {/* connectors */}
        <path d="M150 96 C 200 96, 200 150, 250 150" stroke="#5aa6ff" strokeWidth="2" fill="none" />
        <path d="M150 110 C 210 130, 210 235, 270 235" stroke="#8b7bff" strokeWidth="2" fill="none" />

        {/* users */}
        <EntityCardSvg x={20} y={50} title="users" accent="#5aa6ff" rows={["id", "email", "name"]} pkIndex={0} />
        {/* projects */}
        <EntityCardSvg x={250} y={110} title="projects" accent="#8b7bff" rows={["id", "owner_id", "title"]} pkIndex={0} fkIndex={1} />
        {/* tasks */}
        <EntityCardSvg x={270} y={195} title="tasks" accent="#ef8a52" rows={["id", "project_id", "status"]} pkIndex={0} fkIndex={1} />
      </svg>
    </div>
  );
}

function EntityCardSvg({
  x,
  y,
  title,
  accent,
  rows,
  pkIndex,
  fkIndex,
}: {
  x: number;
  y: number;
  title: string;
  accent: string;
  rows: string[];
  pkIndex?: number;
  fkIndex?: number;
}) {
  const w = 130;
  const headerH = 24;
  const rowH = 22;
  const h = headerH + rows.length * rowH;

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} fill="#131a2b" stroke={accent} strokeWidth={2} />
      <path
        d={`M${x} ${y + 10} a10 10 0 0 1 10 -10 h${w - 20} a10 10 0 0 1 10 10 v${headerH - 10} h-${w} z`}
        fill={accent}
      />
      <text x={x + 10} y={y + 16} fontFamily="monospace" fontSize="12" fontWeight="700" fill="#0b0f17">
        {title}
      </text>
      {rows.map((r, i) => {
        const ry = y + headerH + i * rowH + 15;
        const isPk = i === pkIndex;
        const isFk = i === fkIndex;
        return (
          <g key={r}>
            {(isPk || isFk) && (
              <circle cx={x + 12} cy={ry - 4} r={3} fill={isPk ? accent : "#8b97b0"} />
            )}
            <text
              x={x + (isPk || isFk ? 22 : 12)}
              y={ry}
              fontFamily="monospace"
              fontSize="11"
              fill={isPk ? "#dbe4f3" : "#8b97b0"}
              fontWeight={isPk ? 700 : 400}
            >
              {r}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function Feature({
  color,
  title,
  body,
}: {
  color: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface/60 p-5 text-left transition-colors hover:bg-surface">
      <div
        className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ background: `${color}22`, border: `1px solid ${color}55` }}
      >
        <div className="h-4 w-4 rounded" style={{ background: color }} aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/Brand";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const email = user.email ?? "";
  const initial = email.charAt(0).toUpperCase() || "?";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border-subtle bg-surface/80 px-4 backdrop-blur sm:px-6">
        <Link href="/dashboard" className="cursor-pointer">
          <BrandLogo />
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-ink-muted sm:inline">
            {email}
          </span>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-purple/20 text-sm font-semibold text-accent-purple"
            aria-hidden="true"
          >
            {initial}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="cursor-pointer rounded-lg border border-border-subtle px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-card hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}

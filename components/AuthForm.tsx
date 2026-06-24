"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSignup = mode === "signup";
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName.trim() || undefined } },
        });
        if (error) throw error;

        // If email confirmation is enabled there is no active session yet.
        if (!data.session) {
          setNotice(
            "Account created. Check your email to confirm, then sign in."
          );
          setLoading(false);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }

      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface/80 p-7 shadow-2xl backdrop-blur">
      <h1 className="text-xl font-semibold text-ink">
        {isSignup ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        {isSignup
          ? "Start designing schemas with your own workspace."
          : "Sign in to your ERD Flow workspace."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        {isSignup && (
          <Field
            id="fullName"
            label="Full name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={setFullName}
            placeholder="Ada Lovelace"
          />
        )}
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={setEmail}
          placeholder="you@company.com"
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
        />

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-lg border border-accent-green/30 bg-accent-green/10 px-3 py-2 text-sm text-accent-green"
          >
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full cursor-pointer items-center justify-center rounded-lg bg-accent-blue px-4 py-2.5 text-sm font-semibold text-canvas transition-colors duration-200 hover:bg-[#79b6ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? isSignup
              ? "Creating account…"
              : "Signing in…"
            : isSignup
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        {isSignup ? "Already have an account? " : "Don't have an account? "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="cursor-pointer font-medium text-accent-blue hover:underline"
        >
          {isSignup ? "Sign in" : "Sign up"}
        </Link>
      </p>
    </div>
  );
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-ink"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border-subtle bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-accent-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/40"
      />
    </div>
  );
}

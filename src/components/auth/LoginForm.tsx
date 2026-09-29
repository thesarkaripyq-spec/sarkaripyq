"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { AuthField } from "@/components/auth/AuthField";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border border-ink-100 bg-white p-6 shadow-card">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthField
          label="Email address"
          icon={Mail}
          type="email"
          required
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
        />

        <AuthField
          label="Password"
          labelAction={
            <Link href="/forgot-password" className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Forgot password?
            </Link>
          }
          icon={Lock}
          type="password"
          required
          value={password}
          onChange={setPassword}
          placeholder="Your password"
          autoComplete="current-password"
        />

        {error ? (
          <p className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-500">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !email || !password}
          className="mt-1 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Logging in…" : "Login"}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-ink-300">
        <div className="h-px flex-1 bg-ink-100" />
        or
        <div className="h-px flex-1 bg-ink-100" />
      </div>

      <GoogleButton label="Continue with Google" />

      <p className="mt-5 text-center text-xs text-ink-500">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-brand-600 hover:text-brand-700">
          Sign up
        </Link>
      </p>
    </div>
  );
}

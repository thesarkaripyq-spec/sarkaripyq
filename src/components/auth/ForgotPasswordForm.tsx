"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { AuthField } from "@/components/auth/AuthField";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSent(true);
      } else if (res.status === 429) {
        setError("Too many requests. Please try again later.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto w-full max-w-sm rounded-xl border border-ink-100 bg-white p-6 text-center shadow-card">
        <p className="font-semibold text-ink-900">Check your email</p>
        <p className="mt-1 text-sm text-ink-500">
          If an account exists for <span className="font-medium text-ink-700">{email}</span>, we&apos;ve sent a
          link to reset your password.
        </p>
      </div>
    );
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

        {error ? (
          <p className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-500">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !email}
          className="mt-1 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-ink-500">
        Remembered your password?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Login
        </Link>
      </p>
    </div>
  );
}

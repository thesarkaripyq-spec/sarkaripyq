"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";

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
      <div className="mx-auto w-full max-w-sm text-center">
        <p className="font-semibold text-ink-900">Check your email</p>
        <p className="mt-1 text-sm text-ink-500">
          If an account exists for <span className="font-medium text-ink-700">{email}</span>, we&apos;ve sent a
          link to reset your password.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-sm font-medium text-ink-700">
          Email address
        </label>
        <div className="flex items-center gap-2 rounded-md border border-ink-100 px-3 py-2.5 focus-within:border-brand-500">
          <Mail size={16} className="text-ink-300" aria-hidden />
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full text-base"
          />
        </div>

        {error ? <p className="text-xs text-danger-500">{error}</p> : null}

        <button
          type="submit"
          disabled={pending || !email}
          className="mt-1 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
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

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GoogleButton } from "@/components/auth/GoogleButton";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        // Email confirmation is required before a session is issued.
        setCheckEmail(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (checkEmail) {
    return (
      <div className="mx-auto w-full max-w-sm text-center">
        <p className="font-semibold text-ink-900">Check your email</p>
        <p className="mt-1 text-sm text-ink-500">
          We sent a confirmation link to <span className="font-medium text-ink-700">{email}</span>. Click it to
          activate your account.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="name" className="text-sm font-medium text-ink-700">
          Name
        </label>
        <div className="flex items-center gap-2 rounded-md border border-ink-100 px-3 py-2.5 focus-within:border-brand-500">
          <User size={16} className="text-ink-300" aria-hidden />
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full text-base"
          />
        </div>

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

        <label htmlFor="password" className="text-sm font-medium text-ink-700">
          Password
        </label>
        <div className="flex items-center gap-2 rounded-md border border-ink-100 px-3 py-2.5 focus-within:border-brand-500">
          <Lock size={16} className="text-ink-300" aria-hidden />
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="w-full text-base"
          />
        </div>

        <label htmlFor="confirm-password" className="text-sm font-medium text-ink-700">
          Confirm password
        </label>
        <div className="flex items-center gap-2 rounded-md border border-ink-100 px-3 py-2.5 focus-within:border-brand-500">
          <Lock size={16} className="text-ink-300" aria-hidden />
          <input
            id="confirm-password"
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            className="w-full text-base"
          />
        </div>

        {error ? <p className="text-xs text-danger-500">{error}</p> : null}

        <button
          type="submit"
          disabled={pending || !name || !email || !password || !confirmPassword}
          className="mt-1 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-ink-300">
        <div className="h-px flex-1 bg-ink-100" />
        or
        <div className="h-px flex-1 bg-ink-100" />
      </div>

      <GoogleButton label="Continue with Google" />

      <p className="mt-5 text-center text-xs text-ink-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Login
        </Link>
      </p>
    </div>
  );
}

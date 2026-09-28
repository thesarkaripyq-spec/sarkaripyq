"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

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
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
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
    <div className="mx-auto w-full max-w-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="password" className="text-sm font-medium text-ink-700">
          New password
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
          Confirm new password
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
            placeholder="Re-enter new password"
            className="w-full text-base"
          />
        </div>

        {error ? <p className="text-xs text-danger-500">{error}</p> : null}

        <button
          type="submit"
          disabled={pending || !password || !confirmPassword}
          className="mt-1 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

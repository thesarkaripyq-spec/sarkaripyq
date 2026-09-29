"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthField } from "@/components/auth/AuthField";

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
    <div className="mx-auto w-full max-w-sm rounded-xl border border-ink-100 bg-white p-6 shadow-card">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthField
          label="New password"
          icon={Lock}
          type="password"
          required
          minLength={8}
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          autoComplete="new-password"
        />

        <AuthField
          label="Confirm new password"
          icon={Lock}
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Re-enter new password"
          autoComplete="new-password"
        />

        {error ? (
          <p className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-500">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !password || !confirmPassword}
          className="mt-1 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

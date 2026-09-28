"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeleteAccountButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function deleteAccount() {
    setPending(true);
    setError(false);
    try {
      const res = await fetch("/api/profile/delete", { method: "POST" });
      if (res.ok) {
        await createClient().auth.signOut();
        router.push("/");
        router.refresh();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  if (confirming) {
    return (
      <div className="mt-3">
        <p className="text-xs text-ink-500">
          Type <span className="font-semibold text-ink-900">DELETE</span> to confirm.
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          disabled={pending}
          className="mt-2 w-full max-w-xs rounded-md border border-ink-100 px-3 py-1.5 text-sm"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={deleteAccount}
            disabled={pending || confirmText !== "DELETE"}
            className="rounded-md bg-danger-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-danger-600 disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Permanently delete my account"}
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              setConfirmText("");
            }}
            disabled={pending}
            className="rounded-md border border-ink-100 px-3 py-1.5 text-xs text-ink-500"
          >
            Cancel
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-xs text-danger-500">Something went wrong. Please try again.</p>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="mt-3 rounded-md border border-danger-500 px-4 py-2 text-sm font-semibold text-danger-500 hover:bg-danger-50"
    >
      Delete account
    </button>
  );
}

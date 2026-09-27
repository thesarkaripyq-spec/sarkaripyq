"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResetProgressButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function reset() {
    setPending(true);
    try {
      await fetch("/api/profile/reset", { method: "POST" });
      setConfirming(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (confirming) {
    return (
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="rounded-md bg-danger-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-danger-600 disabled:opacity-50"
        >
          {pending ? "Resetting…" : "Yes, reset everything"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-md border border-ink-100 px-3 py-1.5 text-xs text-ink-500"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="mt-3 rounded-md border border-danger-500 px-4 py-2 text-sm font-semibold text-danger-500 hover:bg-danger-50"
    >
      Reset progress
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export function RemoveBookmarkButton({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    try {
      await fetch("/api/bookmarks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      aria-label="Remove bookmark"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-300 hover:bg-danger-50 hover:text-danger-500 disabled:opacity-50"
    >
      <X size={16} aria-hidden />
    </button>
  );
}

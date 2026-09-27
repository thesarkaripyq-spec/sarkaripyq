"use client";

import { useState } from "react";
import { Flag } from "lucide-react";

export function ReportButton({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit() {
    if (!reason.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch(`/api/questions/${questionId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (open) {
    return (
      <div className="rounded-md border border-ink-100 p-3">
        {status === "sent" ? (
          <p className="text-sm text-ink-700">Thanks — we&apos;ll review this question.</p>
        ) : (
          <>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What's wrong with this question?"
              maxLength={500}
              rows={2}
              className="w-full rounded-md border border-ink-100 p-2 text-sm"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={status === "sending" || !reason.trim()}
                className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Submit
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-ink-100 px-3 py-1.5 text-xs text-ink-500"
              >
                Cancel
              </button>
            </div>
            {status === "error" ? (
              <p className="mt-2 text-xs text-danger-500">Something went wrong. Please try again.</p>
            ) : null}
          </>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex h-11 w-11 items-center justify-center rounded-md border border-ink-100 text-ink-500 hover:border-ink-300"
      aria-label="Report question"
    >
      <Flag size={16} aria-hidden />
    </button>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHero } from "@/components/layout/PageHero";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Set a new password for your SarkariPYQ account.",
  robots: { index: false },
  alternates: { canonical: "/reset-password" },
};

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <PageHero
        icon={KeyRound}
        eyebrow="Account"
        title="Set a new password"
        description={user ? "Choose a new password for your account." : "This reset link is invalid or has expired."}
      />
      <div className="mx-auto max-w-content px-4 py-10">
        {user ? (
          <ResetPasswordForm />
        ) : (
          <div className="mx-auto w-full max-w-sm text-center">
            <p className="text-sm text-ink-500">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Link
              href="/forgot-password"
              className="mt-4 inline-block font-semibold text-brand-600 hover:text-brand-700"
            >
              Request a new link
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

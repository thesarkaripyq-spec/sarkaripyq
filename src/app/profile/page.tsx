import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHero } from "@/components/layout/PageHero";
import { ResetProgressButton } from "@/components/auth/ResetProgressButton";
import { SignOutButton } from "@/components/auth/SignOutButton";

export const metadata: Metadata = {
  title: "Profile",
  description: "Manage your SarkariPYQ account and practice progress.",
  robots: { index: false },
  alternates: { canonical: "/profile" },
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div>
      <PageHero icon={User} eyebrow="Account" title="Profile" />
      <div className="mx-auto max-w-content px-4 py-8 md:py-10">
        <div className="max-w-md rounded-lg border border-ink-100 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-300">Email</p>
          <p className="mt-1 text-sm font-semibold text-ink-900">{user.email}</p>
        </div>

        <div className="mt-6 max-w-md rounded-lg border border-ink-100 p-5">
          <p className="font-semibold text-ink-900">Reset progress</p>
          <p className="mt-1 text-sm text-ink-500">
            Clears every recorded attempt and resets your level back to Beginner. Bookmarks are kept.
          </p>
          <ResetProgressButton />
        </div>

        <div className="mt-6 max-w-md">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}

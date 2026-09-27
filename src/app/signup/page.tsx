import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SignupForm } from "@/components/auth/SignupForm";
import { PageHero } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create a free SarkariPYQ account to track attempts, bookmark questions and see your level.",
  robots: { index: false },
  alternates: { canonical: "/signup" },
};

export default async function SignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div>
      <PageHero
        icon={UserPlus}
        eyebrow="Account"
        title="Create your SarkariPYQ account"
        description="Track your attempts, bookmark questions, and see your level."
      />
      <div className="mx-auto max-w-content px-4 py-10">
        <SignupForm />
      </div>
    </div>
  );
}

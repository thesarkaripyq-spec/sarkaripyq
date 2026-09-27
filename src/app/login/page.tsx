import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/LoginForm";
import { PageHero } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Login",
  description: "Log in to your SarkariPYQ account to track attempts, bookmark questions and see your level.",
  robots: { index: false },
  alternates: { canonical: "/login" },
};

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div>
      <PageHero
        icon={LogIn}
        eyebrow="Account"
        title="Sign in to SarkariPYQ"
        description="Track your attempts, bookmark questions, and see your level."
      />
      <div className="mx-auto max-w-content px-4 py-10">
        <LoginForm />
      </div>
    </div>
  );
}

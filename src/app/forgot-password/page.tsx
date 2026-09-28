import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Reset your SarkariPYQ account password.",
  robots: { index: false },
  alternates: { canonical: "/forgot-password" },
};

export default function ForgotPasswordPage() {
  return (
    <div>
      <PageHero
        icon={KeyRound}
        eyebrow="Account"
        title="Reset your password"
        description="We'll email you a link to set a new password."
      />
      <div className="mx-auto max-w-content px-4 py-10">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}

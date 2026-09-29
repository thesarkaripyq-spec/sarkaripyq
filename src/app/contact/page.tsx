import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the SarkariPYQ team.",
  robots: { index: false },
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div>
      <PageHero
        icon={Mail}
        eyebrow="Support"
        title="Contact Us"
        description="Questions, feedback, or found a problem? We'd love to hear from you."
      />
      <div className="mx-auto max-w-2xl px-4 py-8 md:py-10">
        <div className="rounded-lg border border-ink-100 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Mail size={22} aria-hidden />
          </div>
          <h2 className="mt-4 text-base font-bold text-ink-900">Email us</h2>
          <p className="mt-2 text-sm text-ink-500">
            We reply within 2-4 hours.
          </p>
          <a
            href="mailto:thesarkaripyq@gmail.com"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-card hover:bg-brand-700"
          >
            <Mail size={16} aria-hidden />
            thesarkaripyq@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}
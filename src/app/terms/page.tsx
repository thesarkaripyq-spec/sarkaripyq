import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of SarkariPYQ.",
  robots: { index: false },
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div>
      <PageHero icon={FileText} eyebrow="Legal" title="Terms of Service" />
      <div className="mx-auto max-w-2xl px-4 py-8 md:py-10">
        <div className="rounded-lg border border-danger-500/40 bg-danger-50 p-4 text-sm text-ink-900">
          <p className="font-semibold">DRAFT — not reviewed, not legal advice.</p>
          <p className="mt-1 text-ink-700">
            This page is a structural placeholder. Replace this content with real terms of service — ideally
            reviewed by a lawyer — before launch. Left in place, this notice is deliberately impossible to miss.
          </p>
        </div>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-ink-700">
          <section>
            <h2 className="text-base font-bold text-ink-900">About this site</h2>
            <p className="mt-2">
              SarkariPYQ is a free exam-preparation resource offering previous-year questions and practice tools
              for SSC exams. It is <strong>not affiliated with the Staff Selection Commission (SSC) or the
              Government of India</strong> in any way.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink-900">Accounts</h2>
            <p className="mt-2">
              Creating an account is optional and lets you track practice attempts and bookmark questions.
              You&apos;re responsible for keeping your login credentials secure. You can delete your account at any
              time from your Profile page.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink-900">Content accuracy</h2>
            <p className="mt-2 text-ink-500">
              [Placeholder — needs real content: a disclaimer that questions/answers are provided for practice
              purposes and may contain errors, and that this site isn&apos;t a substitute for official exam
              notifications or source material.]
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink-900">Affiliate links</h2>
            <p className="mt-2">
              The Books page contains Amazon affiliate links. SarkariPYQ may earn a commission on qualifying
              purchases made through those links, at no extra cost to you.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink-900">Limitation of liability</h2>
            <p className="mt-2 text-ink-500">
              [Placeholder — needs real legal content: the actual limitation-of-liability and disclaimer-of-
              warranties language, and which jurisdiction&apos;s law governs these terms.]
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink-900">Changes to these terms</h2>
            <p className="mt-2 text-ink-500">
              [Placeholder — needs real content: how you&apos;ll notify users of material changes to these terms.]
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink-900">Contact</h2>
            <p className="mt-2 text-ink-500">[Placeholder — insert a real contact/support email address here.]</p>
          </section>
        </div>
      </div>
    </div>
  );
}

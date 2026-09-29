import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of SarkariPYQ.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div>
      <PageHero icon={FileText} eyebrow="Legal" title="Terms of Service" />
      <div className="mx-auto max-w-2xl px-4 py-8 md:py-10">
        <div className="space-y-8 text-sm leading-relaxed text-ink-700">
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
              Creating an account is optional and lets you track attempts and bookmark questions. You&apos;re
              responsible for keeping your login credentials secure. You can delete your account at any time from
              your{" "}
              <Link href="/profile" className="text-brand-600 underline">
                Profile
              </Link>{" "}
              page.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink-900">Content accuracy</h2>
            <p className="mt-2">
              Questions and answers are provided for practice only and may contain errors. SarkariPYQ is not a
              substitute for official exam notifications or source material — always verify details against
              official announcements.
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
            <p className="mt-2">
              SarkariPYQ is provided &ldquo;as is&rdquo; without warranties of any kind. To the fullest extent
              permitted by law, we are not liable for any loss or damage arising from your use of the site.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink-900">Changes &amp; contact</h2>
            <p className="mt-2">
              We may update these terms from time to time; the latest version will always be on this page. For
              any questions about these terms, email us at{" "}
              <a href="mailto:thesarkaripyq@gmail.com" className="text-brand-600 underline">
                thesarkaripyq@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
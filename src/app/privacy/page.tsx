import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How SarkariPYQ collects, uses, and protects your data.",
  robots: { index: false },
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div>
      <PageHero icon={ShieldCheck} eyebrow="Legal" title="Privacy Policy" />
      <div className="mx-auto max-w-2xl px-4 py-8 md:py-10">
        <div className="rounded-lg border border-danger-500/40 bg-danger-50 p-4 text-sm text-ink-900">
          <p className="font-semibold">DRAFT — not reviewed, not legal advice.</p>
          <p className="mt-1 text-ink-700">
            This page is a structural placeholder. Replace this content with a real privacy policy — ideally
            reviewed by someone familiar with applicable data protection law (e.g. India&apos;s DPDP Act, 2023) —
            before launch. Left in place, this notice is deliberately impossible to miss.
          </p>
        </div>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-ink-700">
          <section>
            <h2 className="text-base font-bold text-ink-900">Information we collect</h2>
            <p className="mt-2">
              What SarkariPYQ&apos;s code actually does today, factually: when you create an account, we collect
              your email address (via Supabase Auth, or via Google if you sign in with Google). Once signed in, we
              store which questions you&apos;ve attempted, whether you answered correctly, and which questions
              you&apos;ve bookmarked. We use this to show your dashboard, level, and streak.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink-900">Third-party services</h2>
            <p className="mt-2">
              Authentication and data storage: Supabase. Optional sign-in: Google OAuth. Book links on the Books
              page carry an Amazon Associates affiliate tag; clicking one may let Amazon know you came from this
              site. [Placeholder — list anything else added later, e.g. analytics or error tracking, here.]
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink-900">Cookies</h2>
            <p className="mt-2 text-ink-500">
              [Placeholder — needs real content: what cookies are set (Supabase&apos;s auth session cookie, at
              minimum), why, and how a visitor can control them.]
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink-900">Data retention &amp; deletion</h2>
            <p className="mt-2">
              You can delete your account at any time from your{" "}
              <Link href="/profile" className="text-brand-600 underline">
                Profile
              </Link>{" "}
              page, which permanently removes your account, bookmarks, and practice history.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink-900">Your rights</h2>
            <p className="mt-2 text-ink-500">
              [Placeholder — needs real content: what rights you&apos;re offering users over their data (access,
              correction, deletion, portability) and how they can exercise them beyond the self-service deletion
              above.]
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

import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How SarkariPYQ collects, uses, and protects your data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div>
      <PageHero icon={ShieldCheck} eyebrow="Legal" title="Privacy Policy" />
      <div className="mx-auto max-w-2xl px-4 py-8 md:py-10">
        <div className="space-y-8 text-sm leading-relaxed text-ink-700">
          <section>
            <h2 className="text-base font-bold text-ink-900">What we collect</h2>
            <p className="mt-2">
              If you create an account, we collect your email address (directly, or from Google if you sign in
              with Google). We also store which questions you&apos;ve attempted, whether you answered correctly,
              and which questions you&apos;ve bookmarked, so we can show your dashboard, level, and streak.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink-900">How we use it</h2>
            <p className="mt-2">
              We use your data only to run the site — powering your account, progress tracking, and bookmarks.
              We never sell your personal information.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink-900">Third-party services</h2>
            <p className="mt-2">
              Authentication and data storage are handled by Supabase. Optional sign-in uses Google OAuth. The
              Books page carries Amazon affiliate links; clicking one may let Amazon know you came from this
              site.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink-900">Cookies</h2>
            <p className="mt-2">
              We use a session cookie to keep you signed in. You can clear or block cookies in your browser
              settings, but you may be logged out or lose some functionality.
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
            <h2 className="text-base font-bold text-ink-900">Your rights &amp; contact</h2>
            <p className="mt-2">
              You can request access to, correction of, or deletion of your data at any time. For any privacy
              questions, email us at{" "}
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
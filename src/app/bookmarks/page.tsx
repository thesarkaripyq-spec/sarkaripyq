import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getBookmarkedQuestions } from "@/lib/data/dashboard";
import { PageHero } from "@/components/layout/PageHero";
import { EmptyState } from "@/components/ui/EmptyState";
import { MathHtml } from "@/components/ui/MathHtml";
import { RemoveBookmarkButton } from "@/components/question/RemoveBookmarkButton";

export const metadata: Metadata = {
  title: "Bookmarked Questions",
  description: "Your saved SSC practice questions, in one place.",
  robots: { index: false },
  alternates: { canonical: "/bookmarks" },
};

export default async function BookmarksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const bookmarks = await getBookmarkedQuestions(user.id);

  return (
    <div>
      <PageHero
        icon={Bookmark}
        eyebrow="Saved"
        title="Bookmarked Questions"
        description={`${bookmarks.length} question${bookmarks.length === 1 ? "" : "s"} saved for later.`}
      />
      <div className="mx-auto max-w-content px-4 py-8">
        {bookmarks.length === 0 ? (
          <EmptyState
            title="No bookmarks yet"
            description="Tap the bookmark icon on any question while practicing to save it here."
          />
        ) : (
          <div className="space-y-2.5">
            {bookmarks.map((b) => (
              <div
                key={b.bookmarkId}
                className="flex items-center gap-3 rounded-lg border border-ink-100 px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
              >
                <Link
                  href={`/ssc/${b.exam.slug}/pyq/${b.paper.year}/${b.paper.slug}?q=${b.questionNumber}`}
                  className="min-w-0 flex-1"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                    {b.exam.name} &bull; {b.paper.year}
                  </p>
                  <MathHtml className="mt-1 line-clamp-2 text-[15px] text-ink-900" html={b.questionHtml} />
                </Link>
                <RemoveBookmarkButton questionId={b.questionId} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

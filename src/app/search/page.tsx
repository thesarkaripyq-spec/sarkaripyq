import type { Metadata } from "next";
import Link from "next/link";
import { searchQuestions } from "@/lib/data/questions";
import { SearchBar } from "@/components/search/SearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { MathHtml } from "@/components/ui/MathHtml";

export const metadata: Metadata = {
  title: "Search",
  description: "Search SSC previous year questions by exam, subject, year or question text.",
  robots: { index: false },
  alternates: { canonical: "/search" },
};

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = query.length >= 2 ? await searchQuestions(query, 30) : [];

  return (
    <div className="mx-auto max-w-content px-4 py-6">
      <h1 className="sr-only">Search SSC previous year questions</h1>
      <SearchBar autoFocus />

      <div className="mt-6">
        {query.length < 2 ? (
          <EmptyState title="Search SSC PYQs" description="Search by exam, subject, topic, year or question text." />
        ) : results.length === 0 ? (
          <EmptyState title={`No results for "${query}"`} description="Try different keywords." />
        ) : (
          <div className="space-y-2.5">
            {results.map((r) => (
              <Link
                key={r.id}
                href={`/ssc/${r.paper.exam.slug}/pyq/${r.paper.year}/${r.paper.slug}?q=${r.question_number}`}
                className="block rounded-lg border border-ink-100 px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                  {r.paper.exam.name} &bull; {r.paper.year}
                </p>
                <MathHtml className="mt-1 line-clamp-2 text-[15px] text-ink-900" html={r.question_html} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

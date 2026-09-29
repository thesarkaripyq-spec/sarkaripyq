import type { Metadata } from "next";
import { searchQuestions } from "@/lib/data/questions";
import { SearchBar } from "@/components/search/SearchBar";

export const metadata: Metadata = {
  title: "Search",
  description: "Search SSC previous year questions by exam, subject, year or question text.",
  robots: { index: false },
  alternates: { canonical: "/search" },
};

const RESULTS_LIMIT = 24;

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (q ?? "").trim().slice(0, 100);
  const results = query.length >= 2 ? await searchQuestions(query, RESULTS_LIMIT) : [];

  return (
    <div className="mx-auto max-w-content px-4 py-6">
      <h1 className="sr-only">Search SSC previous year questions</h1>
      <SearchBar autoFocus initialQuery={query} initialResults={results} />
    </div>
  );
}

import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { getActiveExams } from "@/lib/data/exams";
import { PageHero } from "@/components/layout/PageHero";
import { BookCard } from "@/components/books/BookCard";
import { EXAM_BOOKS, CORE_SUBJECT_BOOKS } from "@/lib/data/books";

export const metadata: Metadata = {
  title: "Recommended Books",
  description: "Recommended SSC CGL, CHSL, MTS, CPO and GD preparation books by exam and subject.",
  alternates: { canonical: "/books" },
};
export const revalidate = 3600;

export default async function BooksPage() {
  const exams = await getActiveExams();

  return (
    <div>
      <PageHero
        icon={BookOpen}
        eyebrow="Recommended Books"
        title="Best books for SSC exam prep"
        description="Handpicked prep books for each SSC exam, plus the core subject references every aspirant uses."
      />
      <div className="mx-auto max-w-content px-4 py-8 md:py-10">
        <section>
          <h2 className="text-lg font-bold text-ink-900">Previous year papers, by exam</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {exams.map((exam) => {
              const book = EXAM_BOOKS[exam.slug];
              return book ? <BookCard key={exam.id} book={book} /> : null;
            })}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-ink-900">Core subject books (all SSC exams)</h2>
          <p className="mt-1 text-sm text-ink-500">
            Quant, Reasoning, English and GA show up on almost every SSC paper.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CORE_SUBJECT_BOOKS.map((book) => (
              <BookCard key={book.title} book={book} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

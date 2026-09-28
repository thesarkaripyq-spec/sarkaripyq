import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveExams, getSubjectBySlug, getYearsForSubject } from "@/lib/data/exams";
import { listQuestionsBySubject } from "@/lib/data/questions";
import { PracticeBrowser } from "@/components/practice/PracticeBrowser";

export const revalidate = 300;

const PAGE_SIZE = 20;

interface Props {
  params: Promise<{ subject: string }>;
}

// Empty on purpose - see src/app/ssc/[exam]/page.tsx for why this alone
// (zero build-time queries) is enough to unlock on-demand ISR caching.
// The exam/year/tier/page filters (previously read server-side here) are
// now handled entirely client-side by PracticeBrowser - this page always
// renders the default, unfiltered, page-1 view, which is also the
// canonical URL.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subject: subjectSlug } = await params;
  const subject = await getSubjectBySlug(subjectSlug);
  if (!subject) return {};

  return {
    title: `${subject.name} Previous Year Questions`,
    description: `Practice ${subject.name} previous year questions from SSC exams.`,
    alternates: { canonical: `/practice/${subject.slug}` },
  };
}

export default async function SubjectPracticePage({ params }: Props) {
  const { subject: subjectSlug } = await params;

  const subject = await getSubjectBySlug(subjectSlug);
  if (!subject) notFound();

  // Always the default, unfiltered, page-1 view - see the
  // generateStaticParams comment above. Filtering and pagination are
  // handled entirely client-side from here (PracticeBrowser).
  const [exams, years, { items, total }] = await Promise.all([
    getActiveExams(),
    getYearsForSubject(subject.id),
    listQuestionsBySubject(subject.id, { page: 1, pageSize: PAGE_SIZE }),
  ]);

  return (
    <div>
      <div className="mx-auto max-w-content px-4 pt-8">
        <h1 className="text-xl font-bold text-ink-900 md:text-2xl">{subject.name} PYQ</h1>
      </div>

      <PracticeBrowser
        subjectSlug={subjectSlug}
        basePath={`/practice/${subjectSlug}`}
        exams={exams}
        years={years}
        initialItems={items}
        initialTotal={total}
      />
    </div>
  );
}

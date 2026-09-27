import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveExams, getSubjectBySlug, getYearsForSubject } from "@/lib/data/exams";
import { listQuestionsBySubject } from "@/lib/data/questions";
import { FilterBar } from "@/components/exam/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { MathHtml } from "@/components/ui/MathHtml";

export const revalidate = 300;

const PAGE_SIZE = 20;

interface Props {
  params: Promise<{ subject: string }>;
  searchParams: Promise<{ exam?: string; year?: string; tier?: string; page?: string }>;
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

export default async function SubjectPracticePage({ params, searchParams }: Props) {
  const { subject: subjectSlug } = await params;
  const { exam, year, tier, page: pageParam } = await searchParams;

  const subject = await getSubjectBySlug(subjectSlug);
  if (!subject) notFound();

  const page = Math.max(1, Number(pageParam) || 1);
  const yearNum = year ? Number(year) : undefined;

  const [exams, years, { items, total }] = await Promise.all([
    getActiveExams(),
    getYearsForSubject(subject.id),
    listQuestionsBySubject(subject.id, {
      examSlug: exam,
      year: yearNum,
      tier,
      page,
      pageSize: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(p: number) {
    const params = new URLSearchParams();
    if (exam) params.set("exam", exam);
    if (year) params.set("year", year);
    if (tier) params.set("tier", tier);
    params.set("page", String(p));
    return `/practice/${subjectSlug}?${params.toString()}`;
  }

  return (
    <div>
      <div className="mx-auto max-w-content px-4 pt-8">
        <h1 className="text-xl font-bold text-ink-900 md:text-2xl">{subject.name} PYQ</h1>
        <p className="mt-1 text-ink-500">{total} questions across SSC exams.</p>
      </div>

      <div className="mx-auto max-w-content">
        <FilterBar
          action={`/practice/${subjectSlug}`}
          exams={exams}
          years={years}
          selected={{ exam, year, tier }}
        />
      </div>

      <div className="mx-auto max-w-content px-4 py-6">
        {items.length === 0 ? (
          <EmptyState title="No questions match these filters" description="Try clearing a filter." />
        ) : (
          <div className="space-y-2.5">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/ssc/${item.paper.exam.slug}/pyq/${item.paper.year}/${item.paper.slug}?q=${item.question_number}`}
                className="block rounded-lg border border-ink-100 px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                  {item.paper.exam.name} &bull; {item.paper.year}
                </p>
                <MathHtml className="mt-1 line-clamp-2 text-[15px] text-ink-900" html={item.question_html} />
              </Link>
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
      </div>
    </div>
  );
}

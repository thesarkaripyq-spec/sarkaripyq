import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight, GraduationCap } from "lucide-react";
import { notFound } from "next/navigation";
import { getExamBySlug, getSubjectsForExam, getYearsForExam } from "@/lib/data/exams";
import { SubjectCard } from "@/components/exam/SubjectCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHero } from "@/components/layout/PageHero";
import { siteUrl } from "@/lib/utils";

export const revalidate = 300;

interface Props {
  params: Promise<{ exam: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { exam: examSlug } = await params;
  const exam = await getExamBySlug(examSlug);
  if (!exam) return { title: "Exam Not Found", robots: { index: false } };

  return {
    title: `${exam.name} Previous Year Questions`,
    description: `Practice ${exam.name} previous year questions by subject, year and shift.`,
    alternates: { canonical: `/ssc/${exam.slug}` },
  };
}

export default async function ExamOverviewPage({ params }: Props) {
  const { exam: examSlug } = await params;
  const exam = await getExamBySlug(examSlug);
  if (!exam) notFound();

  const [subjects, years, requestHeaders] = await Promise.all([
    getSubjectsForExam(exam.id),
    getYearsForExam(exam.id),
    headers(),
  ]);
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: exam.name, item: `${siteUrl}/ssc/${exam.slug}` },
    ],
  };

  return (
    <div>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <PageHero icon={GraduationCap} eyebrow={exam.name} title={`${exam.name} Previous Year Questions`} description={exam.full_name ?? undefined} />

      <div className="mx-auto max-w-content px-4 py-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Practice by Subject</h2>
          {subjects.length === 0 ? (
            <EmptyState title="Questions coming soon for this exam" />
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {subjects.map((s) => (
                <SubjectCard key={s.id} subject={s} href={`/practice/${s.slug}?exam=${exam.slug}`} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
            Previous Year Papers
          </h2>
          {years.length === 0 ? (
            <EmptyState title="No papers published yet" />
          ) : (
            <Link
              href={`/ssc/${exam.slug}/pyq`}
              className="group flex items-center justify-between rounded-lg border border-ink-100 bg-gradient-to-r from-brand-50 to-white px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card sm:max-w-sm"
            >
              <div>
                <p className="font-semibold text-ink-900">View by year &amp; shift</p>
                <p className="text-sm text-ink-500">{years.length} years available</p>
              </div>
              <ArrowRight size={18} className="text-brand-500 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Clock3 } from "lucide-react";
import { notFound } from "next/navigation";
import { getExamBySlug, getExamTiers, getPapersForExamYear } from "@/lib/data/exams";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHero } from "@/components/layout/PageHero";
import { TierToggle } from "@/components/exam/TierToggle";
import { formatExamDate, siteUrl } from "@/lib/utils";
import { safeJsonLd } from "@/lib/json-ld";

export const revalidate = 300;

interface Props {
  params: Promise<{ exam: string; year: string }>;
  searchParams: Promise<{ tier?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { exam: examSlug, year } = await params;
  const exam = await getExamBySlug(examSlug);
  if (!exam) return { title: "Exam Not Found", robots: { index: false } };

  return {
    title: `${exam.name} ${year} Previous Year Questions`,
    description: `${exam.name} ${year} previous year question papers, shift-wise.`,
    alternates: { canonical: `/ssc/${exam.slug}/pyq/${year}` },
  };
}

export default async function ExamPyqYearPage({ params, searchParams }: Props) {
  const { exam: examSlug, year } = await params;
  const { tier } = await searchParams;
  const yearNum = Number(year);
  const exam = await getExamBySlug(examSlug);
  if (!exam || !Number.isInteger(yearNum)) notFound();

  const [papers, tiers] = await Promise.all([
    getPapersForExamYear(exam.id, yearNum, tier),
    getExamTiers(exam.id),
  ]);
  // Only 404 when the year itself has nothing published — a tier filter
  // that happens to match zero papers for an otherwise-valid year should
  // fall through to the empty state below, not a hard 404.
  if (papers.length === 0 && !tier) notFound();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: exam.name, item: `${siteUrl}/ssc/${exam.slug}` },
      { "@type": "ListItem", position: 3, name: "All Years", item: `${siteUrl}/ssc/${exam.slug}/pyq` },
      { "@type": "ListItem", position: 4, name: String(year), item: `${siteUrl}/ssc/${exam.slug}/pyq/${year}` },
    ],
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />
      <PageHero
        icon={Clock3}
        eyebrow={`${exam.name} ${year}`}
        title={`${exam.name} ${year} PYQ`}
        description="Select a shift to start practicing."
      />
      <TierToggle tiers={tiers} activeTier={tier ?? null} basePath={`/ssc/${exam.slug}/pyq/${year}`} />
      <div className="mx-auto max-w-content px-4 py-8">
        <div className="space-y-2.5">
          {papers.length === 0 ? (
            <EmptyState title="No shifts published for this year yet" />
          ) : (
            papers.map((paper) => (
              <Link
                key={paper.id}
                href={`/ssc/${exam.slug}/pyq/${year}/${paper.slug}`}
                className="group flex items-center justify-between rounded-lg border border-ink-100 px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
              >
                <div>
                  <p className="font-semibold text-ink-900">
                    {paper.tier ? `${paper.tier} — ` : ""}
                    {paper.shift ?? "Shift"}
                  </p>
                  {paper.exam_date ? (
                    <p className="text-sm text-ink-500">{formatExamDate(paper.exam_date)}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-500">
                    {paper.question_count} Qs
                  </span>
                  <ChevronRight size={16} className="text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" aria-hidden />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

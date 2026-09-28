import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { notFound } from "next/navigation";
import { getExamBySlug, getExamTiers, getYearsForExam } from "@/lib/data/exams";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHero } from "@/components/layout/PageHero";
import { TierToggle } from "@/components/exam/TierToggle";
import { siteUrl } from "@/lib/utils";
import { safeJsonLd } from "@/lib/json-ld";

export const revalidate = 300;

interface Props {
  params: Promise<{ exam: string }>;
  searchParams: Promise<{ tier?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { exam: examSlug } = await params;
  const exam = await getExamBySlug(examSlug);
  if (!exam) return { title: "Exam Not Found", robots: { index: false } };

  return {
    title: `${exam.name} Previous Year Questions — All Years`,
    description: `Year-wise list of ${exam.name} previous year question papers.`,
    alternates: { canonical: `/ssc/${exam.slug}/pyq` },
  };
}

export default async function ExamPyqYearsPage({ params, searchParams }: Props) {
  const { exam: examSlug } = await params;
  const { tier } = await searchParams;
  const exam = await getExamBySlug(examSlug);
  if (!exam) notFound();

  const [years, tiers] = await Promise.all([
    getYearsForExam(exam.id, tier),
    getExamTiers(exam.id),
  ]);

  const yearHref = (year: number) =>
    `/ssc/${exam.slug}/pyq/${year}${tier ? `?tier=${encodeURIComponent(tier)}` : ""}`;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: exam.name, item: `${siteUrl}/ssc/${exam.slug}` },
      { "@type": "ListItem", position: 3, name: "All Years", item: `${siteUrl}/ssc/${exam.slug}/pyq` },
    ],
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />
      <PageHero
        icon={CalendarDays}
        eyebrow={exam.name}
        title={`${exam.name} PYQ — All Years`}
        description="Select a year to view available shifts."
      />
      <TierToggle tiers={tiers} activeTier={tier ?? null} basePath={`/ssc/${exam.slug}/pyq`} />
      <div className="mx-auto max-w-content px-4 py-8">
        {years.length === 0 ? (
          <EmptyState title="No papers published yet" description="Check back soon." />
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {years.map((year) => (
              <Link
                key={year}
                href={yearHref(year)}
                className="rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-semibold text-ink-900 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
              >
                {year}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

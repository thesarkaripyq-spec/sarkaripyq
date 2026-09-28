import type { Metadata } from "next";
import { Suspense } from "react";
import { Clock3 } from "lucide-react";
import { notFound } from "next/navigation";
import { getExamBySlug, getExamTiers, getPapersForExamYear } from "@/lib/data/exams";
import { PageHero } from "@/components/layout/PageHero";
import { PapersFilter } from "@/components/exam/PapersFilter";
import { Skeleton } from "@/components/ui/Skeleton";
import { siteUrl } from "@/lib/utils";
import { safeJsonLd } from "@/lib/json-ld";

export const revalidate = 300;

interface Props {
  params: Promise<{ exam: string; year: string }>;
}

// Empty on purpose - see src/app/ssc/[exam]/page.tsx for why this alone
// (zero build-time queries) is enough to unlock on-demand ISR caching for
// every exam+year combination, verified via Cache-Control headers.
export async function generateStaticParams() {
  return [];
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

export default async function ExamPyqYearPage({ params }: Props) {
  const { exam: examSlug, year } = await params;
  const yearNum = Number(year);
  const exam = await getExamBySlug(examSlug);
  if (!exam || !Number.isInteger(yearNum)) notFound();

  const basePath = `/ssc/${exam.slug}/pyq/${year}`;
  // Unfiltered - the tier filter is applied client-side (PapersFilter), so
  // this 404 check now unconditionally reflects "no papers at all for this
  // year," with no tier-dependent special case needed.
  const [papers, tiers] = await Promise.all([
    getPapersForExamYear(exam.id, yearNum),
    getExamTiers(exam.id),
  ]);
  if (papers.length === 0) notFound();

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
      <Suspense
        fallback={
          <div className="mx-auto max-w-content px-4 py-8">
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          </div>
        }
      >
        <PapersFilter basePath={basePath} papers={papers} tiers={tiers} />
      </Suspense>
    </div>
  );
}

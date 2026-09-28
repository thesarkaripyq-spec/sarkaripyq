import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarDays } from "lucide-react";
import { notFound } from "next/navigation";
import { getExamBySlug, getYearsAndTiersForExam } from "@/lib/data/exams";
import { PageHero } from "@/components/layout/PageHero";
import { YearsFilter } from "@/components/exam/YearsFilter";
import { Skeleton } from "@/components/ui/Skeleton";
import { siteUrl } from "@/lib/utils";
import { safeJsonLd } from "@/lib/json-ld";

export const revalidate = 300;

interface Props {
  params: Promise<{ exam: string }>;
}

// Empty on purpose - see src/app/ssc/[exam]/page.tsx for why this alone
// (zero build-time queries) is enough to unlock on-demand ISR caching for
// every exam slug, verified via Cache-Control headers.
export async function generateStaticParams() {
  return [];
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

export default async function ExamPyqYearsPage({ params }: Props) {
  const { exam: examSlug } = await params;
  const exam = await getExamBySlug(examSlug);
  if (!exam) notFound();

  const basePath = `/ssc/${exam.slug}/pyq`;
  const yearsWithTiers = await getYearsAndTiersForExam(exam.id);
  const tiers = [...new Set(yearsWithTiers.map((r) => r.tier))].filter(Boolean);

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
      <Suspense
        fallback={
          <div className="mx-auto max-w-content px-4 py-8">
            <div className="flex flex-wrap gap-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-20" />
              ))}
            </div>
          </div>
        }
      >
        <YearsFilter basePath={basePath} yearsWithTiers={yearsWithTiers} tiers={tiers} />
      </Suspense>
    </div>
  );
}

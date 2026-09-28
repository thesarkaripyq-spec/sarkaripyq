import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExamBySlug, getPaperBySlug, getSubjectsForExam } from "@/lib/data/exams";
import { getQuestionByPaperAndNumber, getQuestionNumbersForPaper } from "@/lib/data/questions";
import { PracticeSession } from "@/components/question/PracticeSession";
import { formatExamDate, siteUrl } from "@/lib/utils";
import { safeJsonLd } from "@/lib/json-ld";

export const revalidate = 300;

interface Props {
  params: Promise<{ exam: string; year: string; shift: string }>;
}

// Empty on purpose - see src/app/ssc/[exam]/page.tsx for why this alone
// (zero build-time queries) is enough to unlock on-demand ISR caching.
// The ?subject=/?q= filters (previously read server-side here) are now
// handled entirely client-side by PracticeSession - this page always
// renders the default, unfiltered, first-question view, which is also
// the canonical URL (generateMetadata below never varied by
// searchParams, so this was already what got indexed).
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { exam: examSlug, year, shift } = await params;
  const exam = await getExamBySlug(examSlug);
  if (!exam) return { title: "Not Found", robots: { index: false } };
  const paper = await getPaperBySlug(exam.id, Number(year), shift);
  if (!paper) return { title: "Not Found", robots: { index: false } };

  return {
    title: `${paper.title} ${paper.shift ?? ""} Previous Year Questions`,
    description: `Practice ${paper.title} ${paper.shift ?? ""} previous year questions with answers and explanations.`,
    alternates: { canonical: `/ssc/${exam.slug}/pyq/${year}/${shift}` },
  };
}

export default async function ShiftPracticePage({ params }: Props) {
  const { exam: examSlug, year, shift } = await params;
  const yearNum = Number(year);

  const exam = await getExamBySlug(examSlug);
  if (!exam || !Number.isInteger(yearNum)) notFound();

  const paper = await getPaperBySlug(exam.id, yearNum, shift);
  if (!paper) notFound();

  const basePath = `/ssc/${exam.slug}/pyq/${year}/${shift}`;

  // Always the default, unfiltered view - see the generateStaticParams
  // comment above. Subject filtering and question navigation are handled
  // entirely client-side from here (PracticeSession).
  const [subjects, questionList] = await Promise.all([
    getSubjectsForExam(exam.id),
    getQuestionNumbersForPaper(paper.id),
  ]);
  const questionNumbers = questionList.map((item) => item.question_number);

  const firstQuestionNumber = questionNumbers[0] ?? null;
  const question = firstQuestionNumber !== null ? await getQuestionByPaperAndNumber(paper.id, firstQuestionNumber) : null;

  const subtitleParts = [paper.exam_date ? formatExamDate(paper.exam_date) : null, paper.shift].filter(
    Boolean,
  );

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: exam.name, item: `${siteUrl}/ssc/${exam.slug}` },
      { "@type": "ListItem", position: 2, name: String(year), item: `${siteUrl}/ssc/${exam.slug}/pyq/${year}` },
      { "@type": "ListItem", position: 3, name: paper.title, item: `${siteUrl}${basePath}` },
    ],
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />
      <h1 className="sr-only">
        {paper.title} {subtitleParts.join(" • ")}
        {firstQuestionNumber !== null ? ` — Question ${firstQuestionNumber}` : ""}
      </h1>
      <PracticeSession
        paperId={paper.id}
        basePath={basePath}
        paperTitle={paper.title}
        paperSubtitle={subtitleParts.length ? subtitleParts.join(" • ") : null}
        subjects={subjects}
        initialSubjectSlug={null}
        initialQuestionNumbers={questionNumbers}
        initialCurrentQuestionNumber={firstQuestionNumber}
        initialQuestion={question}
      />
    </div>
  );
}

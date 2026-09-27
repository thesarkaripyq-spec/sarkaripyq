import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getExamBySlug, getPaperBySlug, getSubjectBySlug, getSubjectsForExam } from "@/lib/data/exams";
import { getQuestionByPaperAndNumber, getQuestionNumbersForPaper } from "@/lib/data/questions";
import { SubjectTabs } from "@/components/exam/SubjectTabs";
import { QuestionPractice } from "@/components/question/QuestionPractice";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatExamDate, siteUrl } from "@/lib/utils";

export const revalidate = 300;

interface Props {
  params: Promise<{ exam: string; year: string; shift: string }>;
  searchParams: Promise<{ q?: string; subject?: string }>;
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

export default async function ShiftPracticePage({ params, searchParams }: Props) {
  const { exam: examSlug, year, shift } = await params;
  const { q, subject: subjectSlug } = await searchParams;
  const yearNum = Number(year);

  const exam = await getExamBySlug(examSlug);
  if (!exam || !Number.isInteger(yearNum)) notFound();

  const paper = await getPaperBySlug(exam.id, yearNum, shift);
  if (!paper) notFound();

  const [subjects, subjectFilter, requestHeaders] = await Promise.all([
    getSubjectsForExam(exam.id),
    subjectSlug ? getSubjectBySlug(subjectSlug) : Promise.resolve(null),
    headers(),
  ]);
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  const questionList = await getQuestionNumbersForPaper(paper.id, subjectFilter?.id);
  const questionNumbers = questionList.map((item) => item.question_number);

  const basePath = `/ssc/${exam.slug}/pyq/${year}/${shift}`;

  if (questionNumbers.length === 0) {
    return (
      <div className="mx-auto max-w-content px-4 py-8">
        <SubjectTabs subjects={subjects} activeSlug={subjectFilter?.slug ?? null} basePath={basePath} />
        <div className="py-6">
          <EmptyState
            title="No questions match this filter"
            description="Try a different subject, or view all questions."
          />
        </div>
      </div>
    );
  }

  const firstQuestionNumber = questionNumbers[0]!;
  const requestedQ = q ? Number(q) : firstQuestionNumber;
  const currentQuestionNumber = questionNumbers.includes(requestedQ) ? requestedQ : firstQuestionNumber;

  const question = await getQuestionByPaperAndNumber(paper.id, currentQuestionNumber);
  if (!question) notFound();

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
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <h1 className="sr-only">
        {paper.title} {subtitleParts.join(" • ")} — Question {currentQuestionNumber}
      </h1>
      <SubjectTabs subjects={subjects} activeSlug={subjectFilter?.slug ?? null} basePath={basePath} />
      <QuestionPractice
        basePath={basePath}
        paperTitle={paper.title}
        paperSubtitle={subtitleParts.length ? subtitleParts.join(" • ") : null}
        questionNumbers={questionNumbers}
        currentQuestionNumber={currentQuestionNumber}
        question={question}
        subjectQuery={subjectFilter?.slug ?? null}
      />
    </div>
  );
}

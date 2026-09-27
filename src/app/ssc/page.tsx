import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { getActiveExams, getPaperCountsByExam } from "@/lib/data/exams";
import { ExamCard } from "@/components/exam/ExamCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHero } from "@/components/layout/PageHero";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "SSC Exams — Previous Year Questions",
  description: "Browse SSC CGL, CHSL, MTS, CPO, GD, Stenographer and Selection Post previous year questions.",
  alternates: { canonical: "/ssc" },
};

export default async function SscExamsPage() {
  const [exams, paperCounts] = await Promise.all([getActiveExams(), getPaperCountsByExam()]);

  return (
    <div>
      <PageHero
        icon={GraduationCap}
        eyebrow="SSC Exams"
        title="SSC Previous Year Questions"
        description="Choose an exam to start practicing real previous year papers."
      />
      <div className="mx-auto max-w-content px-4 py-8">
        {exams.length === 0 ? (
          <EmptyState title="No exams available yet" />
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {exams.map((exam) => (
              <ExamCard key={exam.id} exam={exam} paperCount={paperCounts.get(exam.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

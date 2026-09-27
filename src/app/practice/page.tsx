import type { Metadata } from "next";
import { Layers } from "lucide-react";
import { getAllSubjects } from "@/lib/data/exams";
import { SubjectCard } from "@/components/exam/SubjectCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHero } from "@/components/layout/PageHero";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Practice by Subject",
  description: "Practice SSC previous year questions organized by subject.",
  alternates: { canonical: "/practice" },
};

export default async function PracticeSubjectsPage() {
  const subjects = await getAllSubjects();

  return (
    <div>
      <PageHero
        icon={Layers}
        eyebrow="Practice"
        title="Practice by Subject"
        description="Choose a subject to browse questions across all SSC exams."
      />
      <div className="mx-auto max-w-content px-4 py-8">
        {subjects.length === 0 ? (
          <EmptyState title="No subjects available yet" />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {subjects.map((subject) => (
              <SubjectCard key={subject.id} subject={subject} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

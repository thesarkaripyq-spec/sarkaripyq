import Link from "next/link";
import { Brain, Calculator, Globe2, Languages, Monitor, NotebookText } from "lucide-react";
import type { Subject } from "@/types/database";

const SUBJECT_ICONS: Record<string, typeof Calculator> = {
  "quantitative-aptitude": Calculator,
  reasoning: Brain,
  english: Languages,
  "general-awareness": Globe2,
  hindi: Languages,
  computer: Monitor,
};

export function SubjectCard({ subject, href }: { subject: Subject; href?: string }) {
  const Icon = SUBJECT_ICONS[subject.slug] ?? NotebookText;
  return (
    <Link
      href={href ?? `/practice/${subject.slug}`}
      className="group flex flex-col items-center gap-2 rounded-lg border border-ink-100 px-4 py-4 text-center transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600 group-hover:bg-brand-100">
        <Icon size={20} aria-hidden />
      </span>
      <span className="text-sm font-semibold text-ink-900">{subject.name}</span>
    </Link>
  );
}

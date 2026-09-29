import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Layers,
  Send,
  Smartphone,
  Sparkles,
  Users,
} from "lucide-react";
import { getActiveExams, getAllSubjects, getSiteStats } from "@/lib/data/exams";
import { ExamCard } from "@/components/exam/ExamCard";
import { SubjectCard } from "@/components/exam/SubjectCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { HeroIllustration } from "@/components/layout/HeroIllustration";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "SarkariPYQ: SSC Previous Year Questions, Free PYQ Practice",
  description:
    "Practice real SSC previous year questions by exam, subject, year and shift. Free SSC CGL, CHSL, MTS, CPO, GD Constable and Stenographer PYQs with full explanations.",
  alternates: { canonical: "/" },
};

const FEATURES = [
  {
    icon: BookOpenCheck,
    title: "Real previous year papers",
    description: "Every question is sourced from actual SSC exam papers, not guesswork or predicted sets.",
  },
  {
    icon: ClipboardList,
    title: "Step-by-step explanations",
    description: "Stuck on a question? Every answer comes with a full worked explanation, not just the correct option.",
  },
  {
    icon: Layers,
    title: "Organized by subject & topic",
    description: "Drill Quant, Reasoning, English or GA on their own, or work through a full paper year by year.",
  },
  {
    icon: Sparkles,
    title: "Always free, no signup wall",
    description: "Browse and practice every question without creating an account. Sign in only if you want to bookmark or track attempts.",
  },
  {
    icon: Smartphone,
    title: "Built for mobile",
    description: "Practice on the bus, in a coaching-class break, or between shifts. The whole site is designed mobile-first.",
  },
  {
    icon: GraduationCap,
    title: "Covers every SSC exam",
    description: "CGL, CHSL, MTS, CPO, GD Constable, Stenographer and more, updated as new papers are released.",
  },
];

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-ink-900 md:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-ink-500 md:text-sm">{label}</p>
    </div>
  );
}

export default async function HomePage() {
  const [exams, subjects, stats] = await Promise.all([
    getActiveExams(),
    getAllSubjects(),
    getSiteStats(),
  ]);

  const formattedQuestions =
    stats.questions >= 1000 ? `${Math.floor(stats.questions / 1000)}k+` : `${stats.questions}+`;

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-ink-100 bg-gradient-to-b from-brand-50 via-white to-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-[-8%] h-72 w-72 rounded-full bg-brand-200/40 blur-3xl md:h-96 md:w-96"
        />
        <div className="relative mx-auto grid max-w-content gap-10 px-4 py-14 md:grid-cols-2 md:items-center md:py-20">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-600">
              <Sparkles size={14} aria-hidden />
              All SSC Exams Covered
            </span>

            <h1 className="mt-4 text-3xl font-bold leading-tight text-ink-900 md:text-5xl">
              Master SSC Exams with RealPYQ on SarkariPYQ
            </h1>
            <p className="mt-4 max-w-xl text-base text-ink-500 md:text-lg">
              Select your exam and start practicing with real previous year questions.
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
              <CheckCircle2 size={16} className="text-brand-600" aria-hidden />
              No PDFs, Only Questions
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/ssc"
                className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-card hover:bg-brand-700"
              >
                Start Practicing
                <ArrowRight size={16} aria-hidden />
              </Link>
              <Link
                href="/practice"
                className="inline-flex items-center gap-2 rounded-md border border-ink-100 bg-white px-6 py-3 text-sm font-semibold text-ink-700 hover:border-ink-300"
              >
                Practice by Subject
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-4 rounded-lg border border-ink-100 bg-white/70 p-5 shadow-subtle backdrop-blur sm:max-w-md">
              <StatBlock value={`${stats.papers}+`} label="Real papers" />
              <StatBlock value={formattedQuestions} label="Questions" />
              <StatBlock value={`${stats.exams}+`} label="SSC exams" />
            </div>
          </div>

          <div className="hidden justify-self-center md:block">
            <HeroIllustration />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-content px-4">
        {/* Why SarkariPYQ */}
        <section className="border-b border-ink-100 py-10 md:py-14">
          <h2 className="text-xl font-bold text-ink-900 md:text-2xl">Why practice on SarkariPYQ</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-500 md:text-base">
            No filler, no fake mock tests. Just the real questions that have appeared in past SSC exams, presented
            so you can drill efficiently.
          </p>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-lg border border-ink-100 p-5 hover:border-brand-200 hover:shadow-subtle">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                  <f.icon size={20} aria-hidden />
                </div>
                <h3 className="mt-3.5 font-semibold text-ink-900">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Popular Exams */}
        <section className="border-b border-ink-100 py-10 md:py-14">
          <div className="flex items-end justify-between">
            <h2 className="text-xl font-bold text-ink-900 md:text-2xl">Popular Exams</h2>
            <Link href="/ssc" className="hidden text-sm font-semibold text-brand-500 hover:text-brand-600 sm:block">
              View all &rarr;
            </Link>
          </div>
          {exams.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No exams available yet" />
            </div>
          ) : (
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {exams.map((exam) => (
                <ExamCard key={exam.id} exam={exam} />
              ))}
            </div>
          )}
        </section>

        {/* Practice by Subject */}
        <section className="py-10 md:py-14">
          <h2 className="text-xl font-bold text-ink-900 md:text-2xl">Practice by Subject</h2>
          <p className="mt-2 text-sm text-ink-500">
            Focus on one subject at a time and filter by exam or year.
          </p>
          {subjects.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No subjects available yet" />
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {subjects.map((subject) => (
                <SubjectCard key={subject.id} subject={subject} />
              ))}
            </div>
          )}
        </section>

        {/* Community links — the highlighted closing section */}
        <section className="mb-14 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-10 shadow-card md:mb-16 md:px-10 md:py-14">
          <div className="text-center">
            <h2 className="text-xl font-bold text-white md:text-2xl">Join the SarkariPYQ community</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-brand-50 md:text-base">
              Get new PYQ updates first, and discuss questions with other aspirants.
            </p>
          </div>

          <div className="mx-auto mt-7 grid max-w-2xl gap-3 sm:grid-cols-2">
            <a
              href="https://t.me/sarkaripyq"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg bg-white/10 p-5 backdrop-blur transition-colors hover:bg-white/20"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-brand-600">
                <Send size={20} aria-hidden />
              </div>
              <div>
                <p className="font-semibold text-white">Telegram Channel</p>
                <p className="text-sm text-brand-50">Exam alerts &amp; PYQ updates</p>
              </div>
            </a>

            <a
              href="https://t.me/sscpyqgroup"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg bg-white/10 p-5 backdrop-blur transition-colors hover:bg-white/20"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-brand-600">
                <Users size={20} aria-hidden />
              </div>
              <div>
                <p className="font-semibold text-white">Peer Group</p>
                <p className="text-sm text-brand-50">Discuss questions &amp; strategy</p>
              </div>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

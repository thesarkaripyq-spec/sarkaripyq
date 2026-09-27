import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Bookmark, Clock, Flame, Lightbulb, ListChecks, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLevel } from "@/lib/level";
import {
  deriveDailyActivity,
  deriveExamAccuracy,
  deriveStreak,
  deriveSubjectAccuracy,
  deriveTodayStats,
  deriveWeeklyAccuracyTrend,
  getBookmarkedQuestions,
  getUserAttempts,
} from "@/lib/data/dashboard";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { ContinuePracticeCard } from "@/components/dashboard/ContinuePracticeCard";
import { WeakSubjects } from "@/components/dashboard/WeakSubjects";
import { AccuracyBar } from "@/components/dashboard/AccuracyBar";
import { ActivityBars } from "@/components/dashboard/ActivityBars";
import { ResetProgressButton } from "@/components/auth/ResetProgressButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { MathHtml } from "@/components/ui/MathHtml";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your SSC practice progress, accuracy breakdowns and activity on SarkariPYQ.",
  robots: { index: false },
  alternates: { canonical: "/dashboard" },
};

function StatTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-100 p-4">
      <div className="flex items-center gap-2 text-ink-500">
        <Icon size={14} aria-hidden />
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-1.5 text-xl font-bold text-ink-900">{value}</p>
    </div>
  );
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [attempts, bookmarks] = await Promise.all([
    getUserAttempts(user.id),
    getBookmarkedQuestions(user.id, 4),
  ]);

  const total = attempts.length;
  const correct = attempts.filter((a) => a.isCorrect).length;
  const incorrect = total - correct;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const level = getLevel(total);

  const today = deriveTodayStats(attempts);
  const streak = deriveStreak(attempts);
  const subjectAccuracy = deriveSubjectAccuracy(attempts);
  const examAccuracy = deriveExamAccuracy(attempts);
  const dailyActivity = deriveDailyActivity(attempts, 7);
  const weeklyTrend = deriveWeeklyAccuracyTrend(attempts);
  const recentAttempts = attempts.slice(0, 6);
  const lastAttempt = attempts[0] ?? null;

  const displayName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    (user.user_metadata?.name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "there";

  const weakestSubject = [...subjectAccuracy]
    .filter((s) => s.attempted >= 5)
    .map((s) => ({ ...s, accuracy: Math.round((s.correct / s.attempted) * 100) }))
    .sort((a, b) => a.accuracy - b.accuracy)[0];

  const trendDelta =
    weeklyTrend.thisWeekAccuracy !== null && weeklyTrend.lastWeekAccuracy !== null
      ? weeklyTrend.thisWeekAccuracy - weeklyTrend.lastWeekAccuracy
      : null;

  return (
    <div className="mx-auto max-w-content px-4 py-6 md:py-8">
      <WelcomeHeader name={displayName} />

      {/* Today's progress */}
      <section className="mt-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={ListChecks} label="Attempted today" value={String(today.attempted)} />
          <StatTile icon={Target} label="Accuracy today" value={today.attempted > 0 ? `${today.accuracy}%` : "—"} />
          <StatTile icon={Flame} label="Current streak" value={`${streak} day${streak === 1 ? "" : "s"}`} />
          <StatTile icon={Clock} label="Study time today" value={today.studyMinutes > 0 ? `${today.studyMinutes}m` : "—"} />
        </div>
      </section>

      {/* Continue practice */}
      <section className="mt-6">
        <ContinuePracticeCard last={lastAttempt} />
      </section>

      {/* Your performance */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-ink-900">Your performance</h2>
          {trendDelta !== null ? (
            <p className={`text-xs font-semibold ${trendDelta >= 0 ? "text-success-500" : "text-danger-500"}`}>
              {trendDelta >= 0 ? "▲" : "▼"} {Math.abs(trendDelta)}% vs last week
            </p>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-ink-100 p-4">
            <p className="text-2xl font-bold text-ink-900">{total}</p>
            <p className="text-xs text-ink-500">Questions solved</p>
          </div>
          <div className="rounded-lg border border-ink-100 p-4">
            <p className="text-2xl font-bold text-ink-900">
              <span className="text-success-500">{correct}</span>
              <span className="text-ink-300"> / </span>
              <span className="text-danger-500">{incorrect}</span>
            </p>
            <p className="text-xs text-ink-500">Correct / Incorrect</p>
          </div>
          <div className="rounded-lg border border-ink-100 p-4">
            <p className="text-2xl font-bold text-ink-900">{accuracy}%</p>
            <p className="text-xs text-ink-500">Overall accuracy &bull; {level.label}</p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-ink-100 p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-500">Last 7 days</p>
          <ActivityBars days={dailyActivity} />
        </div>
      </section>

      {/* Weak subjects */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-ink-900">Weak subjects</h2>
        <div className="mt-4">
          <WeakSubjects subjects={subjectAccuracy} />
        </div>
      </section>

      {/* Recommended practice */}
      {weakestSubject ? (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-ink-900">Recommended for you</h2>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <Lightbulb size={18} className="shrink-0 text-brand-600" aria-hidden />
              <p className="text-sm text-ink-900">
                Focus on <span className="font-semibold">{weakestSubject.name}</span> — you&apos;re at{" "}
                {weakestSubject.accuracy}% there, your lowest subject.
              </p>
            </div>
            <Link
              href={`/practice/${weakestSubject.slug}`}
              className="shrink-0 rounded-md bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Practice
            </Link>
          </div>
        </section>
      ) : null}

      {/* Subject / exam breakdown */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="text-lg font-bold text-ink-900">Accuracy by subject</h2>
          <div className="mt-4 space-y-4 rounded-lg border border-ink-100 p-5">
            {subjectAccuracy.length === 0 ? (
              <p className="text-sm text-ink-500">Attempt some questions to see a subject-wise breakdown.</p>
            ) : (
              subjectAccuracy.map((row) => <AccuracyBar key={row.slug} row={row} />)
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink-900">Accuracy by exam</h2>
          <div className="mt-4 space-y-4 rounded-lg border border-ink-100 p-5">
            {examAccuracy.length === 0 ? (
              <p className="text-sm text-ink-500">Attempt some questions to see an exam-wise breakdown.</p>
            ) : (
              examAccuracy.map((row) => <AccuracyBar key={row.slug} row={row} />)
            )}
          </div>
        </section>
      </div>

      {/* Bookmarks + recent activity */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-ink-900">Bookmarks</h2>
            {bookmarks.length > 0 ? (
              <Link href="/bookmarks" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                View all &rarr;
              </Link>
            ) : null}
          </div>
          <div className="mt-4">
            {bookmarks.length === 0 ? (
              <EmptyState icon={Bookmark} title="No bookmarks yet" description="Save questions to revisit them here." />
            ) : (
              <div className="space-y-2">
                {bookmarks.map((b) => (
                  <Link
                    key={b.bookmarkId}
                    href={`/ssc/${b.exam.slug}/pyq/${b.paper.year}/${b.paper.slug}?q=${b.questionNumber}`}
                    className="block rounded-lg border border-ink-100 px-4 py-3 hover:border-brand-200 hover:shadow-subtle"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                      {b.exam.name} &bull; {b.paper.year}
                    </p>
                    <MathHtml className="line-clamp-1 text-sm text-ink-900" html={b.questionHtml} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink-900">Recent activity</h2>
          <div className="mt-4">
            {recentAttempts.length === 0 ? (
              <EmptyState title="No activity yet" description="Your recently practiced exams and subjects show up here." />
            ) : (
              <div className="space-y-2">
                {recentAttempts.map((a) => (
                  <Link
                    key={a.id}
                    href={`/ssc/${a.exam.slug}/pyq/${a.paper.year}/${a.paper.slug}?q=${a.questionNumber}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 px-4 py-3 hover:border-brand-200 hover:shadow-subtle"
                  >
                    <p className="truncate text-sm text-ink-900">
                      <span className="font-medium">{a.exam.name}</span>
                      <span className="text-ink-500"> &bull; {a.subject.name}</span>
                    </p>
                    <span className="shrink-0 text-xs text-ink-300">{timeAgo(a.attemptedAt)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="mt-8 flex justify-end">
        <ResetProgressButton />
      </div>
    </div>
  );
}

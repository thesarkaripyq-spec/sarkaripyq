import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveExams } from "@/lib/data/exams";
import { getLeaderboard, getMyLeaderboardRank, type LeaderboardRow } from "@/lib/data/leaderboard";
import { PageHero } from "@/components/layout/PageHero";
import { EmptyState } from "@/components/ui/EmptyState";

const MIN_ATTEMPTS = 5;

interface Props {
  searchParams: Promise<{ exam?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { exam } = await searchParams;
  return {
    title: exam ? `${exam.toUpperCase()} Leaderboard` : "Leaderboard",
    description: "See how your SSC PYQ practice accuracy ranks against other aspirants, overall or by exam.",
    // Canonicalizes to the unfiltered URL - the ?exam= filters are the same
    // page's client-side view of one underlying leaderboard, not distinct
    // content, matching how the rest of the app treats query-string variants.
    alternates: { canonical: "/leaderboard" },
  };
}

function FilterPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-ink-100 text-ink-700 hover:border-brand-200 hover:text-brand-600 dark:border-ink-700 dark:text-ink-200 dark:hover:border-brand-400"
      }`}
    >
      {label}
    </Link>
  );
}

function YourRankCard({ row }: { row: LeaderboardRow }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3.5 dark:border-ink-700 dark:bg-ink-800">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
        #{row.rank}
      </span>
      <div>
        <p className="text-sm font-semibold text-ink-900 dark:text-white">Your rank</p>
        <p className="text-xs text-ink-500 dark:text-ink-300">
          {row.correct}/{row.attempted} correct &bull; {row.accuracy}% accuracy
        </p>
      </div>
    </div>
  );
}

function LeaderboardRowItem({ row, isYou }: { row: LeaderboardRow; isYou: boolean }) {
  return (
    <div
      className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b border-ink-100 px-4 py-3 last:border-b-0 dark:border-ink-700 sm:grid-cols-[2.5rem_1fr_5rem_5rem_5rem] ${
        isYou ? "bg-brand-50 dark:bg-ink-800" : ""
      }`}
    >
      <span className="flex items-center gap-1 text-sm font-semibold text-ink-500 dark:text-ink-300">
        {row.rank === 1 ? <Trophy size={15} className="text-brand-600" aria-hidden /> : null}
        {row.rank}
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">{row.displayName}</span>
        {isYou ? (
          <span className="shrink-0 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-ink-700 dark:text-brand-300">
            You
          </span>
        ) : null}
      </span>
      <span className="hidden text-right text-sm text-ink-500 dark:text-ink-300 sm:block">{row.attempted}</span>
      <span className="hidden text-right text-sm text-ink-500 dark:text-ink-300 sm:block">{row.correct}</span>
      <span className="text-right text-sm font-semibold text-success-500">{row.accuracy}%</span>
    </div>
  );
}

export default async function LeaderboardPage({ searchParams }: Props) {
  const { exam: examSlug } = await searchParams;
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    exams,
  ] = await Promise.all([supabase.auth.getUser(), getActiveExams()]);

  // An unknown/stale exam slug in the URL just falls back to "All" rather than 404ing.
  const selectedExam = examSlug ? (exams.find((e) => e.slug === examSlug) ?? null) : null;
  const activeSlug = selectedExam?.slug ?? null;

  const [rows, myRank] = await Promise.all([
    getLeaderboard(activeSlug),
    user ? getMyLeaderboardRank(activeSlug) : Promise.resolve(null),
  ]);

  return (
    <div>
      <PageHero
        icon={Users}
        eyebrow="Rankings"
        title="Leaderboard"
        description={
          selectedExam
            ? `Top ${selectedExam.name} performers, ranked by correct answers.`
            : "See how you stack up against other SSC aspirants, across every exam."
        }
      />

      <div className="mx-auto max-w-content px-4 py-6 md:py-8">
        <div className="flex flex-wrap gap-2">
          <FilterPill href="/leaderboard" label="All exams" active={!selectedExam} />
          {exams.map((e) => (
            <FilterPill
              key={e.id}
              href={`/leaderboard?exam=${e.slug}`}
              label={e.name}
              active={selectedExam?.slug === e.slug}
            />
          ))}
        </div>

        <div className="mt-6">
          {!user ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3.5 dark:border-ink-700 dark:bg-ink-800">
              <p className="text-sm text-ink-900 dark:text-ink-100">Sign in to track your own rank.</p>
              <Link
                href="/login"
                className="shrink-0 rounded-md bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700"
              >
                Login
              </Link>
            </div>
          ) : myRank ? (
            <YourRankCard row={myRank} />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-100 px-4 py-3.5 dark:border-ink-700">
              <p className="text-sm text-ink-500 dark:text-ink-300">
                Answer at least {MIN_ATTEMPTS} questions{selectedExam ? ` from ${selectedExam.name}` : ""} to join
                the leaderboard.
              </p>
              <Link
                href={selectedExam ? `/ssc/${selectedExam.slug}` : "/practice"}
                className="shrink-0 rounded-md border border-brand-200 px-3.5 py-2 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:border-ink-700 dark:hover:bg-ink-800"
              >
                Practice now
              </Link>
            </div>
          )}
        </div>

        <div className="mt-6">
          {rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No rankings yet"
              description="Be the first to top the leaderboard — answer a few questions to appear here."
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-ink-100 dark:border-ink-700">
              <div className="grid grid-cols-[2.5rem_1fr_auto] gap-3 border-b border-ink-100 bg-ink-50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-500 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 sm:grid-cols-[2.5rem_1fr_5rem_5rem_5rem]">
                <span>#</span>
                <span>Name</span>
                <span className="hidden text-right sm:block">Attempted</span>
                <span className="hidden text-right sm:block">Correct</span>
                <span className="text-right">Accuracy</span>
              </div>
              {rows.map((row) => (
                <LeaderboardRowItem key={row.userId} row={row} isYou={row.userId === user?.id} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";

// Everything on this page derives from ONE fetch of the user's attempts
// (joined with question/subject/paper/exam) rather than a separate query per
// metric. Firing ~10 concurrent Supabase requests for a single page load was
// both wasteful and the likely cause of a 57014 (statement cancelled) error
// under load - one bounded fetch + pure in-memory derivation avoids that
// entirely, and is just less code.

export interface RawAttempt {
  id: string;
  isCorrect: boolean;
  attemptedAt: string;
  questionNumber: number;
  questionHtml: string;
  subject: { slug: string; name: string };
  exam: { slug: string; name: string };
  paper: { year: number; slug: string };
}

export async function getUserAttempts(userId: string, limit = 5000): Promise<RawAttempt[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("practice_attempts")
    .select(
      "id, is_correct, attempted_at, questions!inner(question_number, question_html, subjects!inner(slug, name), papers!inner(year, slug, exams!inner(slug, name)))",
    )
    .eq("user_id", userId)
    .order("attempted_at", { ascending: false })
    .limit(limit)
    .returns<
      {
        id: string;
        is_correct: boolean;
        attempted_at: string;
        questions: {
          question_number: number;
          question_html: string;
          subjects: { slug: string; name: string };
          papers: { year: number; slug: string; exams: { slug: string; name: string } };
        };
      }[]
    >();

  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    isCorrect: r.is_correct,
    attemptedAt: r.attempted_at,
    questionNumber: r.questions.question_number,
    questionHtml: r.questions.question_html,
    subject: r.questions.subjects,
    exam: r.questions.papers.exams,
    paper: { year: r.questions.papers.year, slug: r.questions.papers.slug },
  }));
}

export interface BreakdownRow {
  slug: string;
  name: string;
  attempted: number;
  correct: number;
}

function aggregate(attempts: RawAttempt[], pick: (a: RawAttempt) => { slug: string; name: string }): BreakdownRow[] {
  const map = new Map<string, BreakdownRow>();
  for (const a of attempts) {
    const { slug, name } = pick(a);
    const entry = map.get(slug) ?? { slug, name, attempted: 0, correct: 0 };
    entry.attempted += 1;
    if (a.isCorrect) entry.correct += 1;
    map.set(slug, entry);
  }
  return [...map.values()].sort((a, b) => b.attempted - a.attempted);
}

export function deriveSubjectAccuracy(attempts: RawAttempt[]): BreakdownRow[] {
  return aggregate(attempts, (a) => a.subject);
}

export function deriveExamAccuracy(attempts: RawAttempt[]): BreakdownRow[] {
  return aggregate(attempts, (a) => a.exam);
}

export interface DailyActivity {
  date: string; // YYYY-MM-DD
  count: number;
}

export function deriveDailyActivity(attempts: RawAttempt[], days: number): DailyActivity[] {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const counts = new Map<string, number>();
  for (const a of attempts) {
    const day = a.attemptedAt.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const result: DailyActivity[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return result;
}

export interface TodayStats {
  attempted: number;
  correct: number;
  accuracy: number;
  studyMinutes: number;
}

export function deriveTodayStats(attempts: RawAttempt[]): TodayStats {
  const todayKey = new Date().toISOString().slice(0, 10);
  const rows = attempts.filter((a) => a.attemptedAt.slice(0, 10) === todayKey);

  const attempted = rows.length;
  const correct = rows.filter((r) => r.isCorrect).length;
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

  // Real signal, not a guess: span between the first and last attempt of the
  // day. There's no session/duration tracking, so this is the only honest
  // proxy for time spent - a single attempt floors to 1 minute rather than 0.
  let studyMinutes = 0;
  if (attempted > 0) {
    const times = rows.map((r) => new Date(r.attemptedAt).getTime());
    const spanMs = Math.max(...times) - Math.min(...times);
    studyMinutes = Math.max(1, Math.round(spanMs / 60000));
  }

  return { attempted, correct, accuracy, studyMinutes };
}

export function deriveStreak(attempts: RawAttempt[]): number {
  const days = new Set(attempts.map((a) => a.attemptedAt.slice(0, 10)));
  if (days.size === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cursor = new Date(today);

  // A streak "counts" today only if today has an attempt; otherwise it can
  // still be alive through yesterday (so it doesn't reset to 0 first thing
  // in the morning before you've practiced yet).
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface WeeklyTrend {
  thisWeekAccuracy: number | null;
  lastWeekAccuracy: number | null;
}

export function deriveWeeklyAccuracyTrend(attempts: RawAttempt[]): WeeklyTrend {
  const startOfThisWeek = new Date();
  startOfThisWeek.setHours(0, 0, 0, 0);
  startOfThisWeek.setDate(startOfThisWeek.getDate() - 6);
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const thisWeek: boolean[] = [];
  const lastWeek: boolean[] = [];
  for (const a of attempts) {
    const t = new Date(a.attemptedAt);
    if (t < startOfLastWeek) continue;
    (t >= startOfThisWeek ? thisWeek : lastWeek).push(a.isCorrect);
  }

  const pct = (arr: boolean[]) =>
    arr.length > 0 ? Math.round((arr.filter(Boolean).length / arr.length) * 100) : null;

  return { thisWeekAccuracy: pct(thisWeek), lastWeekAccuracy: pct(lastWeek) };
}

export interface BookmarkedQuestion {
  bookmarkId: string;
  questionId: string;
  questionNumber: number;
  questionHtml: string;
  createdAt: string;
  exam: { slug: string; name: string };
  paper: { year: number; slug: string };
}

// `limit` defaults to a generous-but-bounded cap rather than being left
// optional - the /bookmarks page calls this with no limit at all, which
// was a genuinely unbounded fetch of a user's entire bookmark history.
export async function getBookmarkedQuestions(userId: string, limit = 500): Promise<BookmarkedQuestion[]> {
  const supabase = await createClient();
  const query = supabase
    .from("bookmarks")
    .select(
      "id, created_at, question_id, questions!inner(question_number, question_html, papers!inner(year, slug, exams!inner(slug, name)))",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data, error } = await query.returns<
    {
      id: string;
      created_at: string;
      question_id: string;
      questions: {
        question_number: number;
        question_html: string;
        papers: { year: number; slug: string; exams: { slug: string; name: string } };
      };
    }[]
  >();

  if (error) throw error;

  return (data ?? []).map((r) => ({
    bookmarkId: r.id,
    questionId: r.question_id,
    questionNumber: r.questions.question_number,
    questionHtml: r.questions.question_html,
    createdAt: r.created_at,
    exam: r.questions.papers.exams,
    paper: { year: r.questions.papers.year, slug: r.questions.papers.slug },
  }));
}

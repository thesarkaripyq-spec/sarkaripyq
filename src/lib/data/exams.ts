import { createPublicClient } from "@/lib/supabase/public";
import { withTimeoutRetry } from "@/lib/supabase/retry";
import type { Exam, Paper, Subject } from "@/types/database";

export async function getActiveExams(category = "ssc"): Promise<Exam[]> {
  const supabase = createPublicClient();
  const { data, error } = await withTimeoutRetry(
    () =>
      supabase
        .from("exams")
        .select("id, slug, category, name, full_name, description, is_active, display_order")
        .eq("category", category)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .returns<Exam[]>(),
    "exams.getActiveExams",
  );

  if (error) throw error;
  return data ?? [];
}

export async function getExamBySlug(slug: string): Promise<Exam | null> {
  const supabase = createPublicClient();
  const { data, error } = await withTimeoutRetry(
    () =>
      supabase
        .from("exams")
        .select("id, slug, category, name, full_name, description, is_active, display_order")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle<Exam>(),
    "exams.getExamBySlug",
  );

  if (error) throw error;
  return data;
}

// DISTINCT is done in Postgres (get_years_for_exam RPC - see migration
// 0009) instead of fetching one row per paper and deduping in JS. The
// tier-filtered variant this used to support is dead: after Phase 2, the
// only remaining caller (the exam overview page) never passed one - the
// tier-filtered view moved to client-side filtering (getYearsAndTiersForExam).
export async function getYearsForExam(examId: string): Promise<number[]> {
  const supabase = createPublicClient();
  const { data, error } = await withTimeoutRetry(
    () => supabase.rpc("get_years_for_exam", { p_exam_id: examId }),
    "exams.getYearsForExam",
  );

  if (error) throw error;
  return (data ?? []).map((row: { year: number }) => row.year);
}

// Every (year, tier) pair for an exam, unfiltered - lets the years-list
// page render statically/ISR (see AUDIT.md A1/Phase 2) and filter by tier
// entirely client-side over this one prefetched list, instead of needing
// a fresh server round-trip per tier selection.
export async function getYearsAndTiersForExam(examId: string): Promise<{ year: number; tier: string }[]> {
  const supabase = createPublicClient();
  const { data, error } = await withTimeoutRetry(
    () => supabase.from("papers").select("year, tier").eq("exam_id", examId).eq("is_published", true),
    "exams.getYearsAndTiersForExam",
  );

  if (error) throw error;
  return (data ?? []) as { year: number; tier: string }[];
}

export async function getPapersForExamYear(examId: string, year: number, tier?: string): Promise<Paper[]> {
  const supabase = createPublicClient();
  let query = supabase
    .from("papers")
    .select("id, exam_id, year, tier, exam_date, shift, slug, title, question_count, is_published")
    .eq("exam_id", examId)
    .eq("year", year)
    .eq("is_published", true);

  if (tier) query = query.eq("tier", tier);

  const { data, error } = await withTimeoutRetry(
    () => query.order("exam_date", { ascending: true }).returns<Paper[]>(),
    "exams.getPapersForExamYear",
  );

  if (error) throw error;
  return data ?? [];
}

// Distinct non-empty tier values with at least one published paper for this
// exam — drives whether a Tier 1/Tier 2 toggle has anything to show. Most
// exams (MTS, GD, Stenographer, Selection Post) are single-tier and this
// returns [] for them. DISTINCT done in Postgres - see migration 0009.
export async function getExamTiers(examId: string): Promise<string[]> {
  const supabase = createPublicClient();
  const { data, error } = await withTimeoutRetry(
    () => supabase.rpc("get_exam_tiers", { p_exam_id: examId }),
    "exams.getExamTiers",
  );

  if (error) throw error;
  return (data ?? []).map((row: { tier: string }) => row.tier);
}

export async function getPaperBySlug(
  examId: string,
  year: number,
  shiftSlug: string,
): Promise<Paper | null> {
  const supabase = createPublicClient();
  const { data, error } = await withTimeoutRetry(
    () =>
      supabase
        .from("papers")
        .select("id, exam_id, year, tier, exam_date, shift, slug, title, question_count, is_published")
        .eq("exam_id", examId)
        .eq("year", year)
        .eq("slug", shiftSlug)
        .eq("is_published", true)
        .maybeSingle<Paper>(),
    "exams.getPaperBySlug",
  );

  if (error) throw error;
  return data;
}

// Caught live (see AUDIT.md H4): the old form of this query fetched one
// row per matching question just to dedupe to distinct subjects in JS,
// and 57014'd on a real exam ("steno") mid-testing. DISTINCT is now done
// in Postgres - see migration 0009.
export async function getSubjectsForExam(examId: string): Promise<Subject[]> {
  const supabase = createPublicClient();
  const { data, error } = await withTimeoutRetry(
    () => supabase.rpc("get_subjects_for_exam", { p_exam_id: examId }),
    "exams.getSubjectsForExam",
  );

  if (error) throw error;
  return (data ?? []) as Subject[];
}

export async function getSubjectBySlug(slug: string): Promise<Subject | null> {
  const supabase = createPublicClient();
  const { data, error } = await withTimeoutRetry(
    () => supabase.from("subjects").select("id, slug, name, display_order").eq("slug", slug).maybeSingle<Subject>(),
    "exams.getSubjectBySlug",
  );

  if (error) throw error;
  return data;
}

// DISTINCT done in Postgres - see migration 0009. The old form fetched
// one row per matching question across every exam for this subject, just
// to dedupe to a handful of years in JS - the same shape that 57014'd for
// getSubjectsForExam, and likely the most expensive instance of it (a
// subject spans every exam, not just one).
export async function getYearsForSubject(subjectId: string): Promise<number[]> {
  const supabase = createPublicClient();
  const { data, error } = await withTimeoutRetry(
    () => supabase.rpc("get_years_for_subject", { p_subject_id: subjectId }),
    "exams.getYearsForSubject",
  );

  if (error) throw error;
  return (data ?? []).map((row: { year: number }) => row.year);
}

// Aggregated (GROUP BY) in Postgres - see migration 0009. Same "fetch
// every row, aggregate in JS" shape as the others above; not caught
// failing live like getSubjectsForExam (papers is a much smaller table
// than questions), fixed here for consistency while already touching
// every other instance of the pattern.
export async function getPaperCountsByExam(): Promise<Map<string, number>> {
  const supabase = createPublicClient();
  const { data, error } = await withTimeoutRetry(
    () => supabase.rpc("get_paper_counts_by_exam"),
    "exams.getPaperCountsByExam",
  );

  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { exam_id: string; paper_count: number }[]) {
    counts.set(row.exam_id, row.paper_count);
  }
  return counts;
}

export interface SiteStats {
  papers: number;
  questions: number;
  exams: number;
}

export async function getSiteStats(): Promise<SiteStats> {
  const supabase = createPublicClient();
  const [papers, questions, exams] = await Promise.all([
    withTimeoutRetry(
      () => supabase.from("papers").select("id", { count: "exact", head: true }).eq("is_published", true),
      "exams.getSiteStats.papers",
    ),
    // "exact" scans all 100k+ rows and reliably hits the 57014 statement
    // timeout under the anon role (see questions.ts for the same issue on a
    // smaller join) - "estimated" uses the planner's row estimate instead.
    withTimeoutRetry(
      () => supabase.from("questions").select("id", { count: "estimated", head: true }).eq("is_published", true),
      "exams.getSiteStats.questions",
    ),
    withTimeoutRetry(
      () => supabase.from("exams").select("id", { count: "exact", head: true }).eq("is_active", true),
      "exams.getSiteStats.exams",
    ),
  ]);

  return {
    papers: papers.count ?? 0,
    questions: questions.count ?? 0,
    exams: exams.count ?? 0,
  };
}

export async function getAllSubjects(): Promise<Subject[]> {
  const supabase = createPublicClient();
  const { data, error } = await withTimeoutRetry(
    () =>
      supabase
        .from("subjects")
        .select("id, slug, name, display_order")
        .order("display_order", { ascending: true })
        .returns<Subject[]>(),
    "exams.getAllSubjects",
  );

  if (error) throw error;
  return data ?? [];
}

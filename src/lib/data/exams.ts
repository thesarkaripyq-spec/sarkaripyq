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

export async function getYearsForExam(examId: string, tier?: string): Promise<number[]> {
  const supabase = createPublicClient();
  let query = supabase
    .from("papers")
    .select("year")
    .eq("exam_id", examId)
    .eq("is_published", true);

  if (tier) query = query.eq("tier", tier);

  const { data, error } = await withTimeoutRetry(
    () => query.order("year", { ascending: false }),
    "exams.getYearsForExam",
  );

  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.year as number))];
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
// returns [] for them.
export async function getExamTiers(examId: string): Promise<string[]> {
  const supabase = createPublicClient();
  const { data, error } = await withTimeoutRetry(
    () => supabase.from("papers").select("tier").eq("exam_id", examId).eq("is_published", true),
    "exams.getExamTiers",
  );

  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.tier as string))].filter(Boolean);
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

export async function getSubjectsForExam(examId: string): Promise<Subject[]> {
  const supabase = createPublicClient();
  const { data, error } = await withTimeoutRetry(
    () =>
      supabase
        .from("questions")
        .select("subjects!inner(id, slug, name, display_order), papers!inner(exam_id)")
        .eq("papers.exam_id", examId)
        .returns<{ subjects: Subject }[]>(),
    "exams.getSubjectsForExam",
  );

  if (error) throw error;

  const seen = new Map<string, Subject>();
  for (const row of data ?? []) {
    if (row.subjects) seen.set(row.subjects.id, row.subjects);
  }
  return [...seen.values()].sort((a, b) => a.display_order - b.display_order);
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

export async function getYearsForSubject(subjectId: string): Promise<number[]> {
  const supabase = createPublicClient();
  const { data, error } = await withTimeoutRetry(
    () =>
      supabase
        .from("questions")
        .select("papers!inner(year)")
        .eq("subject_id", subjectId)
        .eq("is_published", true)
        .returns<{ papers: { year: number } }[]>(),
    "exams.getYearsForSubject",
  );

  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.papers.year))].sort((a, b) => b - a);
}

export async function getPaperCountsByExam(): Promise<Map<string, number>> {
  const supabase = createPublicClient();
  const { data, error } = await withTimeoutRetry(
    () => supabase.from("papers").select("exam_id").eq("is_published", true),
    "exams.getPaperCountsByExam",
  );

  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.exam_id, (counts.get(row.exam_id) ?? 0) + 1);
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

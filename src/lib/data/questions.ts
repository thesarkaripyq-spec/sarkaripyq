import { createPublicClient } from "@/lib/supabase/public";
import { withTimeoutRetry } from "@/lib/supabase/retry";
import type { OptionRow, QuestionDetail, QuestionListItem } from "@/types/database";

interface QuestionRow {
  id: string;
  paper_id: string;
  subject_id: string;
  topic_id: string | null;
  question_number: number;
  question_html: string;
  image_url: string | null;
  explanation_html: string | null;
  options: OptionRow[];
}

export async function getQuestionNumbersForPaper(
  paperId: string,
  subjectId?: string,
): Promise<QuestionListItem[]> {
  const supabase = createPublicClient();
  let query = supabase
    .from("questions")
    .select("id, paper_id, subject_id, topic_id, question_number")
    .eq("paper_id", paperId)
    .eq("is_published", true)
    .order("question_number", { ascending: true });

  if (subjectId) query = query.eq("subject_id", subjectId);

  const { data, error } = await withTimeoutRetry(() => query.returns<QuestionListItem[]>());
  if (error) throw error;
  return data ?? [];
}

export async function getQuestionByPaperAndNumber(
  paperId: string,
  questionNumber: number,
): Promise<QuestionDetail | null> {
  const supabase = createPublicClient();
  const { data, error } = await withTimeoutRetry(() =>
    supabase
      .from("questions")
      .select(
        "id, paper_id, subject_id, topic_id, question_number, question_html, image_url, explanation_html, options(id, question_id, label, option_html, image_url, is_correct, display_order)",
      )
      .eq("paper_id", paperId)
      .eq("question_number", questionNumber)
      .eq("is_published", true)
      .maybeSingle<QuestionRow>(),
  );

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    options: (data.options ?? []).sort((a, b) => a.display_order - b.display_order),
  };
}

export interface SubjectBrowseFilters {
  examSlug?: string;
  year?: number;
  tier?: string;
  page?: number;
  pageSize?: number;
}

export interface SubjectBrowseItem {
  id: string;
  question_number: number;
  question_html: string;
  paper: {
    year: number;
    slug: string;
    title: string;
    exam: { slug: string; name: string };
  };
}

export async function listQuestionsBySubject(
  subjectId: string,
  filters: SubjectBrowseFilters = {},
): Promise<{ items: SubjectBrowseItem[]; total: number }> {
  const { examSlug, year, tier, page = 1, pageSize = 20 } = filters;
  const supabase = createPublicClient();

  let query = supabase
    .from("questions")
    .select(
      "id, question_number, question_html, papers!inner(year, slug, title, tier, exams!inner(slug, name))",
      // "exact" forces Postgres to fully evaluate the joined/filtered set to
      // count it, which blows past the statement timeout on popular
      // subjects (24k+ matching rows through a 3-way join). "estimated"
      // uses the query planner's row estimate above a threshold instead —
      // the page-count display becomes approximate, but the page loads.
      { count: "estimated" },
    )
    .eq("subject_id", subjectId)
    .eq("is_published", true);

  if (examSlug) query = query.eq("papers.exams.slug", examSlug);
  if (year) query = query.eq("papers.year", year);
  if (tier) query = query.eq("papers.tier", tier);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await withTimeoutRetry(() =>
    query.order("question_number", { ascending: true }).range(from, from + pageSize - 1),
  );

  if (error) throw error;

  const items: SubjectBrowseItem[] = (data ?? []).map((row: any) => ({
    id: row.id,
    question_number: row.question_number,
    question_html: row.question_html,
    paper: {
      year: row.papers.year,
      slug: row.papers.slug,
      title: row.papers.title,
      exam: { slug: row.papers.exams.slug, name: row.papers.exams.name },
    },
  }));

  return { items, total: count ?? 0 };
}

export interface QuestionSearchResult {
  id: string;
  question_number: number;
  question_html: string;
  paper: {
    year: number;
    slug: string;
    exam: { slug: string; name: string };
  };
}

export async function searchQuestions(query: string, limit = 20): Promise<QuestionSearchResult[]> {
  const supabase = createPublicClient();
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await withTimeoutRetry(() =>
    supabase
      .from("questions")
      .select("id, question_number, question_html, papers!inner(year, slug, exams!inner(slug, name))")
      .eq("is_published", true)
      .textSearch("search_vector", trimmed, { type: "plain", config: "simple" })
      .limit(limit),
  );

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    question_number: row.question_number,
    question_html: row.question_html,
    paper: {
      year: row.papers.year,
      slug: row.papers.slug,
      exam: { slug: row.papers.exams.slug, name: row.papers.exams.name },
    },
  }));
}

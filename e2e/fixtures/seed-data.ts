import { createClient } from "@supabase/supabase-js";
import ws from "ws";

function publicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws as never },
  });
}

// CGL 2024 Tier 1 Shift 1 - see supabase/seed/0001_sample_data.sql. Several
// seeded papers share the slug "shift-1" across different exams/years, so
// this filters precisely by exam+year+tier+slug rather than slug alone.
export async function findSeededPaperId(): Promise<string> {
  const { data, error } = await publicClient()
    .from("papers")
    .select("id, exams!inner(slug)")
    .eq("exams.slug", "cgl")
    .eq("year", 2024)
    .eq("tier", "Tier 1")
    .eq("slug", "shift-1")
    .single();
  if (error || !data) throw error ?? new Error("seeded paper not found");
  return data.id;
}

// Question 1 on that same paper.
export async function findSeededQuestionId(): Promise<string> {
  const paperId = await findSeededPaperId();
  const { data, error } = await publicClient()
    .from("questions")
    .select("id")
    .eq("paper_id", paperId)
    .eq("question_number", 1)
    .single();
  if (error || !data) throw error ?? new Error("seeded question not found");
  return data.id;
}

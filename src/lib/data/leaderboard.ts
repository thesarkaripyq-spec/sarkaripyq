import { createClient } from "@/lib/supabase/server";

export interface LeaderboardRow {
  userId: string;
  displayName: string;
  attempted: number;
  correct: number;
  accuracy: number;
  rank: number;
}

interface LeaderboardRpcRow {
  user_id: string;
  display_name: string;
  attempted: number;
  correct: number;
  accuracy: number;
  rank: number;
}

function mapRow(r: LeaderboardRpcRow): LeaderboardRow {
  return {
    userId: r.user_id,
    displayName: r.display_name,
    attempted: r.attempted,
    correct: r.correct,
    accuracy: r.accuracy,
    rank: r.rank,
  };
}

export async function getLeaderboard(examSlug: string | null, limit = 50): Promise<LeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_leaderboard", { p_exam_slug: examSlug, p_limit: limit });

  if (error) throw error;
  return ((data ?? []) as LeaderboardRpcRow[]).map(mapRow);
}

// Only meaningful for a signed-in caller - the function scopes to auth.uid()
// server-side, so an anon caller would just get an empty result.
export async function getMyLeaderboardRank(examSlug: string | null): Promise<LeaderboardRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_leaderboard_rank", { p_exam_slug: examSlug });

  if (error) throw error;
  const rows = (data ?? []) as LeaderboardRpcRow[];
  return rows[0] ? mapRow(rows[0]) : null;
}

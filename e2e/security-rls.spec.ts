import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { createConfirmedTestUser, deleteTestUser, TEST_USER_PASSWORD } from "./fixtures/test-user";
import { findSeededQuestionId } from "./fixtures/seed-data";

// Tests RLS itself, not just this app's own .eq("user_id", ...) filtering -
// signs in as each user directly via @supabase/supabase-js and queries the
// tables straight, the same way a compromised/malicious client bypassing
// this app's UI entirely would. If RLS is doing its job, that's exactly
// the scenario it has to hold up against.
function anonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws as never },
  });
}

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws as never },
  });
}

test.describe("RLS: bookmarks and attempts are strictly per-user", () => {
  let userAId: string;
  let userBId: string;
  let userBEmail: string;
  let bookmarkId: string;
  let attemptId: string;
  let clientB: ReturnType<typeof anonClient>;

  test.beforeAll(async () => {
    const [userA, userB, questionId] = await Promise.all([
      createConfirmedTestUser("rls-a"),
      createConfirmedTestUser("rls-b"),
      findSeededQuestionId(),
    ]);
    userAId = userA.id;
    userBId = userB.id;
    userBEmail = userB.email;

    const clientA = anonClient();
    await clientA.auth.signInWithPassword({ email: userA.email, password: TEST_USER_PASSWORD });

    const { data: bookmark, error: bookmarkError } = await clientA
      .from("bookmarks")
      .insert({ user_id: userAId, question_id: questionId })
      .select("id")
      .single();
    if (bookmarkError || !bookmark) throw bookmarkError ?? new Error("bookmark insert failed");
    bookmarkId = bookmark.id;

    const { data: attempt, error: attemptError } = await clientA
      .from("practice_attempts")
      .insert({ user_id: userAId, question_id: questionId, is_correct: true })
      .select("id")
      .single();
    if (attemptError || !attempt) throw attemptError ?? new Error("attempt insert failed");
    attemptId = attempt.id;

    await clientA.auth.signOut();

    clientB = anonClient();
    await clientB.auth.signInWithPassword({ email: userBEmail, password: TEST_USER_PASSWORD });
  });

  test.afterAll(async () => {
    await Promise.all([deleteTestUser(userAId), deleteTestUser(userBId)]);
  });

  test("user B cannot read user A's bookmark by id", async () => {
    const { data, error } = await clientB.from("bookmarks").select("id").eq("id", bookmarkId);
    expect(error).toBeNull();
    expect(data).toEqual([]); // RLS filters it out entirely - not a 403, just invisible
  });

  test("user B cannot delete user A's bookmark", async () => {
    await clientB.from("bookmarks").delete().eq("id", bookmarkId);

    // Verify via the admin client (bypasses RLS) that A's row still exists.
    const { data } = await adminClient().from("bookmarks").select("id").eq("id", bookmarkId).maybeSingle();
    expect(data).not.toBeNull();
  });

  test("user B cannot read user A's practice attempt", async () => {
    const { data, error } = await clientB.from("practice_attempts").select("id").eq("id", attemptId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test("user B's own unfiltered bookmarks query never includes user A's rows", async () => {
    // No filter at all - if RLS weren't enforced, this would return every
    // user's bookmarks, including A's.
    const { data, error } = await clientB.from("bookmarks").select("id, user_id");
    expect(error).toBeNull();
    expect(data?.some((row) => row.user_id === userAId)).toBe(false);
  });
});

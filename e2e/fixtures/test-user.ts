import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import ws from "ws";

// Same fixed expected value as e2e/global-setup.ts, checked again here
// independently - this file creates/deletes real auth users, so it
// refuses to touch anything that isn't unmistakably the test project,
// regardless of whether global-setup already checked it once.
const TEST_PROJECT_REF = "gadeobjbzjnpuvwvbrdq";

// Fixed, not secret - every test user shares it; only the throwaway
// test project is ever exposed to it.
export const TEST_USER_PASSWORD = "E2E-test-password-1";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.includes(TEST_PROJECT_REF)) {
    throw new Error(
      `Refusing to create/delete auth users: NEXT_PUBLIC_SUPABASE_URL does not match the test project (${TEST_PROJECT_REF}). Got: ${url || "(empty)"}.`,
    );
  }
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    // Plain Node (unlike Next's runtime) has no native WebSocket support
    // until Node 22 - createClient() eagerly constructs a Realtime
    // client regardless of whether anything here uses realtime
    // features, so it needs an explicit transport or the constructor
    // itself throws.
    // Cast needed: @types/ws's constructor signature doesn't structurally
    // match realtime-js's WebSocketLikeConstructor (a real type mismatch,
    // not just caution) even though this is Supabase's own documented
    // fix for this exact error.
    realtime: { transport: ws as never },
  });
}

// example.com (RFC 2606) rather than the also-reserved .invalid: GoTrue's
// own signUp() validation rejects a .invalid address outright ("email
// address is invalid") even though admin.createUser() tolerates it -
// found by actually calling the public signUp() the real form uses, not
// assumed. example.com is a real, resolving domain that simply never
// accepts mail for any address under it, so this still can't reach a
// real inbox.
export function testUserEmail(purpose: string): string {
  return `e2e-${purpose}-${randomUUID()}@example.com`;
}

// For tests that need an already-logged-in-able user (bookmarks,
// attempts, login) without driving the signup form itself.
export async function createConfirmedTestUser(purpose: string): Promise<{ id: string; email: string }> {
  const email = testUserEmail(purpose);
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  return { id: data.user.id, email };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const { error } = await adminClient().auth.admin.deleteUser(userId);
  if (error) throw error;
}

// For cleaning up a user created through the UI (signup form), where
// the test never directly receives an id.
export async function findTestUserIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await adminClient().auth.admin.listUsers();
  if (error) throw error;
  return data.users.find((u) => u.email === email)?.id ?? null;
}

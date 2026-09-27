import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  questionId: z.string().uuid(),
  selectedOptionId: z.string().uuid().nullable(),
  isCorrect: z.boolean(),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimit(`attempts:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Practice works without an account; attempts are only persisted when signed in.
  if (!user) return NextResponse.json({ ok: true, recorded: false });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { error } = await supabase.from("practice_attempts").insert({
    user_id: user.id,
    question_id: parsed.data.questionId,
    selected_option_id: parsed.data.selectedOptionId,
    is_correct: parsed.data.isCorrect,
  });

  if (error) {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, recorded: true });
}

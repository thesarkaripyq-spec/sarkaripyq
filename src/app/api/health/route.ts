import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

// Deliberately no auth/rate-limit/same-origin checks, unlike every other
// route in this app - this one is meant to be hit frequently and
// non-interactively by uptime monitors and load balancers, not browsers.
export async function GET() {
  try {
    const supabase = createPublicClient();
    const { error } = await supabase.from("exams").select("id").limit(1);
    if (error) throw error;

    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "error", timestamp: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

import { NextResponse } from "next/server";
import { searchQuestions } from "@/lib/data/questions";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimit(`search:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    const results = await searchQuestions(q, 8);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

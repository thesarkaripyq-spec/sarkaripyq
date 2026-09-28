import { NextResponse } from "next/server";
import { z } from "zod";
import { getSubjectBySlug } from "@/lib/data/exams";
import { listQuestionsBySubject } from "@/lib/data/questions";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

// Backs the client-side exam/year/tier filters and pagination on the
// (now static/ISR) subject browse page - see AUDIT.md A1/Phase 2. Public,
// read-only, cookie-free (public client), cacheable.
const PAGE_SIZE = 20;
const TIERS = ["Tier 1", "Tier 2"] as const;

const paramsSchema = z.object({ subject: z.string().trim().min(1).max(60) }).strict();

const querySchema = z
  .object({
    exam: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    tier: z.enum(TIERS).optional(),
    page: z.coerce.number().int().min(1).max(1000).optional(),
  })
  .strict();

export async function GET(request: Request, { params }: { params: Promise<{ subject: string }> }) {
  const ip = getClientIp(request);
  if (!rateLimit(`practice-subject:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const parsedQuery = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { subject: subjectSlug } = parsedParams.data;
  const { exam, year, tier, page = 1 } = parsedQuery.data;

  try {
    const subject = await getSubjectBySlug(subjectSlug);
    if (!subject) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const { items, total } = await listQuestionsBySubject(subject.id, {
      examSlug: exam,
      year,
      tier,
      page,
      pageSize: PAGE_SIZE,
    });

    return NextResponse.json(
      { items, total, page, pageSize: PAGE_SIZE },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=31535700" } },
    );
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

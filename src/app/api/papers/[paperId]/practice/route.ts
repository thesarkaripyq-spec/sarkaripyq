import { NextResponse } from "next/server";
import { z } from "zod";
import { getSubjectBySlug } from "@/lib/data/exams";
import { getQuestionByPaperAndNumber, getQuestionNumbersForPaper } from "@/lib/data/questions";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

// Backs the client-side subject filter / question navigation on the
// (now static/ISR) shift practice page - see AUDIT.md A1/Phase 2. Public,
// read-only, cookie-free (uses the same public client as the page's own
// server-side data fetching); cacheable since the response only depends
// on the request's own params, not on any session.
const paramsSchema = z.object({ paperId: z.string().uuid() }).strict();

const querySchema = z
  .object({
    subject: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    q: z.coerce.number().int().positive().max(1000).optional(),
  })
  .strict();

export async function GET(request: Request, { params }: { params: Promise<{ paperId: string }> }) {
  const ip = getClientIp(request);
  if (!rateLimit(`papers-practice:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  // Pass every key actually present in the query string (not a hand-picked
  // subset) so .strict() can actually reject an unexpected param - building
  // the object from only the keys we expect would make .strict() a no-op.
  const parsedQuery = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { paperId } = parsedParams.data;
  const { subject: subjectSlug, q } = parsedQuery.data;

  try {
    const subjectFilter = subjectSlug ? await getSubjectBySlug(subjectSlug) : null;
    const questionList = await getQuestionNumbersForPaper(paperId, subjectFilter?.id);
    const questionNumbers = questionList.map((item) => item.question_number);

    const cacheHeaders = { "Cache-Control": "s-maxage=300, stale-while-revalidate=31535700" };

    if (questionNumbers.length === 0) {
      return NextResponse.json(
        { questionNumbers: [], currentQuestionNumber: null, question: null },
        { headers: cacheHeaders },
      );
    }

    const firstQuestionNumber = questionNumbers[0]!;
    const requestedQ = q ?? firstQuestionNumber;
    const currentQuestionNumber = questionNumbers.includes(requestedQ) ? requestedQ : firstQuestionNumber;

    const question = await getQuestionByPaperAndNumber(paperId, currentQuestionNumber);
    if (!question) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return NextResponse.json({ questionNumbers, currentQuestionNumber, question }, { headers: cacheHeaders });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

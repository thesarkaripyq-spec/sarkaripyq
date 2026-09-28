import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression coverage for the migration-0009 fix (see AUDIT.md H4): these
// functions used to fetch one row per question/paper and dedupe/aggregate
// in JS - one of them (getSubjectsForExam) 57014'd on real data because of
// it. The fix pushes DISTINCT/GROUP BY into Postgres via RPC instead. This
// verifies each function calls the *right* RPC with the *right* params and
// maps its rows correctly - not a substitute for an integration test
// against a real database (that's Phase 5), but it does mean a future
// change that reverts to fetching a raw table/reshapes the RPC response
// gets caught here instead of silently passing.
const rpcMock = vi.fn();

vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({ rpc: rpcMock }),
}));

describe("exams.ts catalog lookups (RPC-backed)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("getYearsForExam calls get_years_for_exam and returns the years as-is (Postgres already dedupes/orders)", async () => {
    rpcMock.mockResolvedValue({ data: [{ year: 2024 }, { year: 2023 }], error: null });
    const { getYearsForExam } = await import("./exams");

    const years = await getYearsForExam("exam-1");

    expect(rpcMock).toHaveBeenCalledWith("get_years_for_exam", { p_exam_id: "exam-1" });
    expect(years).toEqual([2024, 2023]);
  });

  it("getExamTiers calls get_exam_tiers and returns the tier values", async () => {
    rpcMock.mockResolvedValue({ data: [{ tier: "Tier 1" }, { tier: "Tier 2" }], error: null });
    const { getExamTiers } = await import("./exams");

    const tiers = await getExamTiers("exam-1");

    expect(rpcMock).toHaveBeenCalledWith("get_exam_tiers", { p_exam_id: "exam-1" });
    expect(tiers).toEqual(["Tier 1", "Tier 2"]);
  });

  it("getSubjectsForExam calls get_subjects_for_exam and returns the subject rows", async () => {
    const subjects = [{ id: "s1", slug: "reasoning", name: "Reasoning", display_order: 1 }];
    rpcMock.mockResolvedValue({ data: subjects, error: null });
    const { getSubjectsForExam } = await import("./exams");

    const result = await getSubjectsForExam("exam-1");

    expect(rpcMock).toHaveBeenCalledWith("get_subjects_for_exam", { p_exam_id: "exam-1" });
    expect(result).toEqual(subjects);
  });

  it("getYearsForSubject calls get_years_for_subject and returns the years", async () => {
    rpcMock.mockResolvedValue({ data: [{ year: 2022 }], error: null });
    const { getYearsForSubject } = await import("./exams");

    const years = await getYearsForSubject("subject-1");

    expect(rpcMock).toHaveBeenCalledWith("get_years_for_subject", { p_subject_id: "subject-1" });
    expect(years).toEqual([2022]);
  });

  it("getPaperCountsByExam calls get_paper_counts_by_exam and builds a Map from the grouped rows", async () => {
    rpcMock.mockResolvedValue({
      data: [
        { exam_id: "exam-1", paper_count: 12 },
        { exam_id: "exam-2", paper_count: 5 },
      ],
      error: null,
    });
    const { getPaperCountsByExam } = await import("./exams");

    const counts = await getPaperCountsByExam();

    expect(rpcMock).toHaveBeenCalledWith("get_paper_counts_by_exam");
    expect(counts.get("exam-1")).toBe(12);
    expect(counts.get("exam-2")).toBe(5);
  });

  it("propagates an error instead of silently returning an empty result", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "42883", message: "function does not exist" } });
    const { getSubjectsForExam } = await import("./exams");

    await expect(getSubjectsForExam("exam-1")).rejects.toBeTruthy();
  });
});

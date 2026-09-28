"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { SubjectTabs } from "@/components/exam/SubjectTabs";
import { QuestionPractice } from "@/components/question/QuestionPractice";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchParamsBridge } from "@/components/ui/SearchParamsBridge";
import type { QuestionDetail, Subject } from "@/types/database";

interface PracticeState {
  subjectSlug: string | null;
  questionNumbers: number[];
  currentQuestionNumber: number | null;
  question: QuestionDetail | null;
}

export function PracticeSession({
  paperId,
  basePath,
  paperTitle,
  paperSubtitle,
  subjects,
  initialSubjectSlug,
  initialQuestionNumbers,
  initialCurrentQuestionNumber,
  initialQuestion,
}: {
  paperId: string;
  basePath: string;
  paperTitle: string;
  paperSubtitle: string | null;
  subjects: Subject[];
  initialSubjectSlug: string | null;
  initialQuestionNumbers: number[];
  initialCurrentQuestionNumber: number | null;
  initialQuestion: QuestionDetail | null;
}) {
  const [state, setState] = useState<PracticeState>({
    subjectSlug: initialSubjectSlug,
    questionNumbers: initialQuestionNumbers,
    currentQuestionNumber: initialCurrentQuestionNumber,
    question: initialQuestion,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // The server already rendered this exact (subject, q) combination -
  // skip the redundant fetch on a normal, unfiltered page load.
  const currentKeyRef = useRef(`${initialSubjectSlug ?? ""}:${initialCurrentQuestionNumber ?? ""}`);

  const handleParamsChange = useCallback(
    (params: URLSearchParams) => {
      const subjectSlug = params.get("subject");
      const qParam = params.get("q");
      const key = `${subjectSlug ?? ""}:${qParam ?? ""}`;
      if (key === currentKeyRef.current) return;
      currentKeyRef.current = key;

      setLoading(true);
      setError(false);

      const url = new URL(`/api/papers/${paperId}/practice`, window.location.origin);
      if (subjectSlug) url.searchParams.set("subject", subjectSlug);
      if (qParam) url.searchParams.set("q", qParam);

      fetch(url)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error("request failed"))))
        .then((data) => {
          setState({
            subjectSlug,
            questionNumbers: data.questionNumbers ?? [],
            currentQuestionNumber: data.currentQuestionNumber ?? null,
            question: data.question ?? null,
          });
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    },
    [paperId],
  );

  return (
    <>
      <Suspense fallback={null}>
        <SearchParamsBridge onChange={handleParamsChange} />
      </Suspense>

      <div className="relative">
        <SubjectTabs subjects={subjects} activeSlug={state.subjectSlug} basePath={basePath} />
        {loading ? (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2 size={16} className="animate-spin text-brand-500" aria-label="Loading" />
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mx-auto max-w-content px-4 py-6">
          <p className="text-sm text-danger-500">Something went wrong loading this question. Please try again.</p>
        </div>
      ) : state.questionNumbers.length === 0 || !state.question || state.currentQuestionNumber === null ? (
        <div className="mx-auto max-w-content px-4 py-8">
          <EmptyState
            title="No questions match this filter"
            description="Try a different subject, or view all questions."
          />
        </div>
      ) : (
        <div className={loading ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}>
          <QuestionPractice
            basePath={basePath}
            paperTitle={paperTitle}
            paperSubtitle={paperSubtitle}
            questionNumbers={state.questionNumbers}
            currentQuestionNumber={state.currentQuestionNumber}
            question={state.question}
            subjectQuery={state.subjectSlug}
          />
        </div>
      )}
    </>
  );
}

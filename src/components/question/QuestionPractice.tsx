"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Option } from "@/components/question/Option";
import { Explanation } from "@/components/question/Explanation";
import { MathHtml } from "@/components/ui/MathHtml";
import { QuestionNavigation } from "@/components/question/QuestionNavigation";
import { BookmarkButton } from "@/components/question/BookmarkButton";
import { ReportButton } from "@/components/question/ReportButton";
import type { QuestionDetail } from "@/types/database";

interface Props {
  basePath: string; // e.g. /ssc/cgl/pyq/2024/shift-2
  paperTitle: string;
  paperSubtitle: string | null;
  questionNumbers: number[]; // filtered, ordered list of question_number
  currentQuestionNumber: number;
  question: QuestionDetail;
  subjectQuery: string | null;
}

export function QuestionPractice({
  basePath,
  paperTitle,
  paperSubtitle,
  questionNumbers,
  currentQuestionNumber,
  question,
  subjectQuery,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const index = questionNumbers.indexOf(currentQuestionNumber);
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < questionNumbers.length - 1;

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (subjectQuery) params.set("subject", subjectQuery);
    return params;
  }, [subjectQuery]);

  function goTo(questionNumber: number) {
    const params = new URLSearchParams(query);
    params.set("q", String(questionNumber));
    setSelectedOptionId(null);
    setRevealed(false);
    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`);
    });
  }

  function selectOption(optionId: string) {
    if (revealed) return;
    setSelectedOptionId(optionId);
    setRevealed(true);

    const option = question.options.find((o) => o.id === optionId);
    fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: question.id,
        selectedOptionId: optionId,
        isCorrect: Boolean(option?.is_correct),
      }),
    }).catch(() => {});
  }

  const correctOption = question.options.find((o) => o.is_correct);
  const isCorrect = selectedOptionId
    ? question.options.find((o) => o.id === selectedOptionId)?.is_correct
    : null;

  return (
    <div className="mx-auto max-w-content px-4 py-6">
      <div className="border-b border-ink-100 pb-3">
        <p className="font-semibold text-ink-900">{paperTitle}</p>
        {paperSubtitle ? <p className="text-sm text-ink-500">{paperSubtitle}</p> : null}
      </div>

      <div className="flex items-center justify-between py-3">
        <p className="text-sm font-medium text-ink-500">
          Question {index + 1} / {questionNumbers.length}
        </p>
        <div className="flex gap-2">
          <BookmarkButton questionId={question.id} />
          <ReportButton questionId={question.id} />
        </div>
      </div>

      <MathHtml
        className="text-[17px] leading-relaxed text-ink-900 [&_img]:mt-2 [&_img]:max-w-full [&_table]:max-w-full [&_table]:overflow-x-auto"
        html={question.question_html}
      />
      {question.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={question.image_url}
          alt={`Diagram for question ${index + 1}`}
          loading="lazy"
          decoding="async"
          className="mt-3 max-w-full rounded-md"
        />
      ) : null}

      <div className="mt-4 space-y-2.5">
        {question.options.map((option) => (
          <Option
            key={option.id}
            option={option}
            selected={selectedOptionId === option.id}
            revealed={revealed}
            onSelect={() => selectOption(option.id)}
          />
        ))}
      </div>

      {revealed ? (
        <>
          <p className={`mt-4 text-sm font-semibold ${isCorrect ? "text-success-600" : "text-danger-600"}`}>
            {isCorrect ? "Correct" : `Incorrect — correct answer: ${correctOption?.label ?? ""}`}
          </p>
          {question.explanation_html ? <Explanation html={question.explanation_html} /> : null}
        </>
      ) : null}

      <QuestionNavigation
        onPrev={() => hasPrev && goTo(questionNumbers[index - 1]!)}
        onNext={() => hasNext && goTo(questionNumbers[index + 1]!)}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />
    </div>
  );
}

import { cn } from "@/lib/utils";
import { MathHtmlInline } from "@/components/ui/MathHtml";
import type { OptionRow } from "@/types/database";

export function Option({
  option,
  selected,
  revealed,
  onSelect,
}: {
  option: OptionRow;
  selected: boolean;
  revealed: boolean;
  onSelect: () => void;
}) {
  const showCorrect = revealed && option.is_correct;
  const showIncorrect = revealed && selected && !option.is_correct;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={revealed}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-[15px] leading-relaxed transition-colors",
        "disabled:cursor-default",
        showCorrect && "border-success-500 bg-success-50",
        showIncorrect && "border-danger-500 bg-danger-50",
        !revealed && selected && "border-brand-500 bg-brand-50/50",
        !revealed && !selected && "border-ink-100 hover:border-ink-300",
        revealed && !showCorrect && !showIncorrect && "border-ink-100",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
          showCorrect && "border-success-500 text-success-600",
          showIncorrect && "border-danger-500 text-danger-600",
          !revealed && selected && "border-brand-500 text-brand-500",
          !revealed && !selected && "border-ink-300 text-ink-500",
          revealed && !showCorrect && !showIncorrect && "border-ink-300 text-ink-500",
        )}
      >
        {option.label}
      </span>
      <MathHtmlInline
        className="pt-0.5 text-ink-900 [&_img]:mt-2 [&_img]:max-w-full [&_table]:max-w-full [&_table]:overflow-x-auto"
        html={option.option_html}
      />
    </button>
  );
}

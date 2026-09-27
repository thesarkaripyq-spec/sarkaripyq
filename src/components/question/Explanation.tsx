import { MathHtml } from "@/components/ui/MathHtml";

export function Explanation({ html }: { html: string }) {
  return (
    <div className="mt-4 rounded-md border border-ink-100 bg-ink-50/60 p-4">
      <p className="mb-1.5 text-sm font-semibold text-ink-700">Explanation</p>
      <MathHtml
        className="text-[15px] leading-relaxed text-ink-700 [&_img]:mt-2 [&_img]:max-w-full [&_table]:max-w-full [&_table]:overflow-x-auto"
        html={html}
      />
    </div>
  );
}

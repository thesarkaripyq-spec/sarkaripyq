import type { Exam } from "@/types/database";

const TIERS = ["Tier 1", "Tier 2"];

export function FilterBar({
  action,
  exams,
  years,
  selected,
}: {
  action: string;
  exams: Exam[];
  years: number[];
  selected: { exam?: string; year?: string; tier?: string };
}) {
  return (
    <form
      action={action}
      className="flex flex-wrap gap-2 border-b border-ink-100 bg-white px-4 py-3 md:sticky md:top-[67px]"
    >
      <select
        name="exam"
        defaultValue={selected.exam ?? ""}
        className="rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-700"
      >
        <option value="">All exams</option>
        {exams.map((e) => (
          <option key={e.id} value={e.slug}>
            {e.name}
          </option>
        ))}
      </select>

      {years.length > 0 ? (
        <select
          name="year"
          defaultValue={selected.year ?? ""}
          className="rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-700"
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      ) : null}

      <select
        name="tier"
        defaultValue={selected.tier ?? ""}
        className="rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-700"
      >
        <option value="">All tiers</option>
        {TIERS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <button
        type="submit"
        className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white"
      >
        Apply
      </button>
    </form>
  );
}

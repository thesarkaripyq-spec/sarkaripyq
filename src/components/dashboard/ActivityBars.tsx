import type { DailyActivity } from "@/lib/data/dashboard";

// Single series (attempts per day) -> one consistent hue, no categorical
// palette needed. Bars are directly meaningful without hover since the
// range is small (14 days); today is called out with a label underneath.
export function ActivityBars({ days }: { days: DailyActivity[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));

  return (
    <div className="flex items-end gap-1.5" style={{ height: 96 }}>
      {days.map((d) => {
        const date = new Date(`${d.date}T00:00:00`);
        const isToday = d.date === new Date().toISOString().slice(0, 10);
        const heightPct = d.count === 0 ? 3 : Math.max(8, Math.round((d.count / max) * 100));
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex h-full w-full items-end" title={`${d.count} attempt${d.count === 1 ? "" : "s"} on ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}>
              <div
                className={`w-full rounded-t ${isToday ? "bg-brand-600" : "bg-brand-200"}`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className="text-[10px] text-ink-300">{date.toLocaleDateString("en-IN", { weekday: "narrow" })}</span>
          </div>
        );
      })}
    </div>
  );
}

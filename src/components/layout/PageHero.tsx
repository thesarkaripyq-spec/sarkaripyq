import type { LucideIcon } from "lucide-react";

export function PageHero({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-ink-100 bg-gradient-to-b from-brand-50 via-white to-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 right-[-8%] h-56 w-56 rounded-full bg-brand-200/40 blur-3xl"
      />
      <div className="relative mx-auto max-w-content px-4 py-8 md:py-11">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-600">
          <Icon size={13} aria-hidden />
          {eyebrow}
        </span>
        <h1 className="mt-3 text-2xl font-bold text-ink-900 md:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-xl text-sm text-ink-500 md:text-base">{description}</p> : null}
      </div>
    </section>
  );
}

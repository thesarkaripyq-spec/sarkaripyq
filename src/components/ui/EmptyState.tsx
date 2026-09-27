import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-ink-100 px-6 py-12 text-center">
      {Icon ? <Icon size={24} className="mb-2 text-ink-300" aria-hidden /> : null}
      <p className="font-medium text-ink-700">{title}</p>
      {description ? <p className="mt-1 text-sm text-ink-500">{description}</p> : null}
    </div>
  );
}

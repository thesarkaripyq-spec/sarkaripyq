import { ExternalLink } from "lucide-react";
import { amazonSearchLink, type BookRecommendation } from "@/lib/data/books";

export function BookCard({ book }: { book: BookRecommendation }) {
  const Icon = book.icon;
  return (
    <div className="flex flex-col justify-between rounded-lg border border-ink-100 p-5">
      <div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-600">
          <Icon size={20} aria-hidden />
        </div>
        <p className="mt-3.5 font-semibold text-ink-900">{book.title}</p>
        <p className="mt-0.5 text-sm text-ink-500">{book.author}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">{book.note}</p>
      </div>
      <a
        href={amazonSearchLink(book.query)}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        View on Amazon
        <ExternalLink size={14} aria-hidden />
      </a>
    </div>
  );
}

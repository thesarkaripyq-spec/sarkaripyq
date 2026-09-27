import Link from "next/link";

const HELPFUL_LINKS = [
  { href: "/", label: "Home" },
  { href: "/ssc", label: "Browse SSC exams" },
  { href: "/practice", label: "Practice by subject" },
  { href: "/search", label: "Search questions" },
];

export default function NotFound() {
  return (
    <div className="mx-auto max-w-content px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-ink-900">Page not found</h1>
      <p className="mt-2 text-ink-500">The page you&apos;re looking for doesn&apos;t exist.</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {HELPFUL_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-md border border-ink-100 px-4 py-2 text-sm font-semibold text-ink-700 hover:border-brand-200 hover:text-brand-600"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

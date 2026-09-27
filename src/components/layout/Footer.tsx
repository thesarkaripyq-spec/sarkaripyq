import Link from "next/link";

export function Footer() {
  return (
    <footer className="mb-14 mt-12 w-full bg-ink-900 py-10 md:mb-0">
      <div className="mx-auto flex max-w-content flex-col items-center gap-3 px-4 text-center text-sm text-ink-300">
        <p className="text-base font-bold text-white">SarkariPYQ</p>
        <p>Practice. Revise. Crack SSC.</p>
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          <Link href="/ssc" className="transition-colors hover:text-white">
            SSC PYQ
          </Link>
          <Link href="/practice" className="transition-colors hover:text-white">
            Subjects
          </Link>
          <Link href="/books" className="transition-colors hover:text-white">
            Books
          </Link>
          <Link href="/search" className="transition-colors hover:text-white">
            Search
          </Link>
        </nav>
        <p className="mt-2 text-xs text-ink-500">
          &copy; {new Date().getFullYear()} SarkariPYQ. Not affiliated with SSC or the Government of India.
        </p>
      </div>
    </footer>
  );
}

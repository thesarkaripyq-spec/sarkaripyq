import Link from "next/link";
import { BookOpen, LayoutGrid, Search, Users } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { AuthStatus } from "@/components/layout/AuthStatus";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/95 shadow-subtle backdrop-blur dark:border-ink-700 dark:bg-ink-900/95">
      <div className="h-[3px] w-full bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600" />
      <div className="mx-auto flex h-16 max-w-content items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="text-xl font-extrabold tracking-tight text-ink-900 dark:text-white">
            Sarkari<span className="text-brand-600">PYQ</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-semibold text-ink-700 dark:text-ink-200 md:flex">
          <Link href="/" className="flex items-center gap-1.5 transition-colors hover:text-brand-600">
            <LayoutGrid size={15} aria-hidden />
            Home
          </Link>
          <Link href="/ssc/cgl" className="transition-colors hover:text-brand-600">
            SSC CGL PYQ
          </Link>
          <Link href="/ssc/chsl" className="transition-colors hover:text-brand-600">
            SSC CHSL PYQ
          </Link>
          <Link href="/books" className="flex items-center gap-1.5 transition-colors hover:text-brand-600">
            <BookOpen size={15} aria-hidden />
            Books
          </Link>
          <Link
            href="/leaderboard"
            className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-brand-700 transition-colors hover:bg-brand-100 dark:bg-ink-700 dark:text-brand-300 dark:hover:bg-ink-600"
          >
            <Users size={15} aria-hidden />
            Leaderboard
          </Link>
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href="/search"
            aria-label="Search"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-700 md:hidden"
          >
            <Search size={20} aria-hidden />
          </Link>

          <Link
            href="/search"
            aria-label="Search"
            className="hidden h-9 w-9 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-700 md:flex"
          >
            <Search size={18} aria-hidden />
          </Link>

          <ThemeToggle />

          <MobileMenu />

          <AuthStatus />
        </div>
      </div>
    </header>
  );
}

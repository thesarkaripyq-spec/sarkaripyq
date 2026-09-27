"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, LayoutGrid, Menu, Search, User as UserIcon, Users, X } from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: LayoutGrid },
  { href: "/ssc/cgl", label: "SSC CGL PYQ", icon: null },
  { href: "/ssc/chsl", label: "SSC CHSL PYQ", icon: null },
  { href: "/books", label: "Books", icon: BookOpen },
  { href: "/leaderboard", label: "Leaderboard", icon: Users },
];

export function MobileMenu({ user }: { user: { email: string } | null }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Esc closes; Tab/Shift+Tab is trapped inside the panel while open;
  // focus moves into the panel on open and back to the trigger on close.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])',
    );
    focusable?.[0]?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key === "Tab" && focusable && focusable.length > 0) {
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        className="flex h-11 w-11 items-center justify-center rounded-full text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-700 md:hidden"
      >
        <Menu size={22} aria-hidden />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="absolute inset-0 bg-black/40"
            onClick={close}
          />
          <div
            id="mobile-menu-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-white p-4 shadow-card dark:bg-ink-900"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-extrabold text-ink-900 dark:text-white">
                Sarkari<span className="text-brand-600">PYQ</span>
              </span>
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="flex h-11 w-11 items-center justify-center rounded-full text-ink-500 hover:bg-ink-50 dark:hover:bg-ink-700"
              >
                <X size={20} aria-hidden />
              </button>
            </div>

            <nav className="mt-4 flex flex-col gap-1 text-sm font-semibold text-ink-700 dark:text-ink-200">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={close}
                  className="flex items-center gap-2.5 rounded-md px-3 py-3 hover:bg-ink-50 dark:hover:bg-ink-800"
                >
                  {Icon ? <Icon size={17} aria-hidden /> : null}
                  {label}
                </Link>
              ))}
              <Link
                href="/search"
                onClick={close}
                className="flex items-center gap-2.5 rounded-md px-3 py-3 hover:bg-ink-50 dark:hover:bg-ink-800"
              >
                <Search size={17} aria-hidden />
                Search
              </Link>
            </nav>

            <div className="mt-auto flex flex-col gap-2 border-t border-ink-100 pt-4 dark:border-ink-700">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    onClick={close}
                    className="flex items-center gap-2.5 rounded-md border border-ink-100 px-3 py-3 text-sm font-semibold text-ink-700 dark:border-ink-700 dark:text-ink-200"
                  >
                    <UserIcon size={17} aria-hidden />
                    Dashboard
                  </Link>
                  <div onClick={close}>
                    <SignOutButton />
                  </div>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={close}
                    className="rounded-md border border-ink-100 px-3 py-3 text-center text-sm font-semibold text-ink-700 dark:border-ink-700 dark:text-ink-200"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    onClick={close}
                    className="rounded-md bg-brand-600 px-3 py-3 text-center text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    Sign Up Free
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

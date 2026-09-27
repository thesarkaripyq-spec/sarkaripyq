"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PencilLine, BarChart3, Bookmark, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNav({ isAuthed }: { isAuthed: boolean }) {
  const pathname = usePathname();

  const items = [
    { href: "/", label: "Home", icon: Home },
    { href: "/practice", label: "Practice", icon: PencilLine },
    { href: isAuthed ? "/dashboard" : "/login", label: "Progress", icon: BarChart3 },
    { href: isAuthed ? "/bookmarks" : "/login", label: "Bookmarks", icon: Bookmark },
    { href: isAuthed ? "/profile" : "/login", label: isAuthed ? "Profile" : "Login", icon: User },
  ];

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white dark:border-ink-700 dark:bg-ink-900 md:hidden">
      <ul className="flex h-14 items-stretch justify-around">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={label} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-xs",
                  active ? "text-brand-500" : "text-ink-500 dark:text-ink-300",
                )}
              >
                <Icon size={20} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

"use client";

import { useLayoutEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  // Always starts as "light" to match the server-rendered markup (the server
  // can't see localStorage). The layout effect below corrects it from the
  // DOM attribute — already set pre-paint by the inline script in layout.tsx —
  // before the browser paints, so there's no visible flash and no hydration
  // mismatch. See node_modules/next/dist/docs/.../preventing-flash-before-hydration.md
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useLayoutEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-9 w-9 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-700"
    >
      {theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}

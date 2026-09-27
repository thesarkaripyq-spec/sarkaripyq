"use client";

import { useEffect, useRef } from "react";
import renderMathInElement from "katex/contrib/auto-render";
import "katex/dist/katex.min.css";

const DELIMITERS = [
  { left: "\\(", right: "\\)", display: false },
  { left: "\\[", right: "\\]", display: true },
  { left: "$$", right: "$$", display: true },
];

// Question/option/explanation HTML is imported content with raw LaTeX
// delimiters embedded (e.g. `\(\sqrt{3}\)`), never pre-rendered. This
// processes them into typeset math client-side after the HTML lands in the
// DOM. throwOnError is off because some imported entries have malformed
// LaTeX — better to show KaTeX's inline error span than crash the page.
function useMathRender<T extends HTMLElement>(html: string) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;
    renderMathInElement(ref.current, { delimiters: DELIMITERS, throwOnError: false });
  }, [html]);

  return ref;
}

export function MathHtml({ html, className }: { html: string; className?: string }) {
  const ref = useMathRender<HTMLDivElement>(html);
  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

// Same as MathHtml but renders a <span> — for spots (like an option's answer
// text sitting next to its label span inside a <button>) where the content
// needs to stay an inline element rather than a block-level <div>.
export function MathHtmlInline({ html, className }: { html: string; className?: string }) {
  const ref = useMathRender<HTMLSpanElement>(html);
  return <span ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

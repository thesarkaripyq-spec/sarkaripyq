// Escapes `<` (the character that can terminate a <script> element early)
// so JSON-LD embedded via dangerouslySetInnerHTML can never break out of
// its script tag, even if a DB-sourced value (exam/paper/subject name)
// ever contained a literal "</script>". Safe to apply universally: `<`
// never appears in valid JSON-LD's own syntax outside of string values.
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

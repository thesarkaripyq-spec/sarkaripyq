import { describe, expect, it } from "vitest";
import { safeJsonLd } from "./json-ld";

describe("safeJsonLd", () => {
  it("stringifies normally when there's nothing to escape", () => {
    expect(safeJsonLd({ a: 1, b: "text" })).toBe('{"a":1,"b":"text"}');
  });

  it("escapes every '<' so a </script> value can't break out of the script tag", () => {
    const output = safeJsonLd({ name: 'Evil</script><script>alert(1)</script>' });
    expect(output).not.toContain("</script>");
    expect(output).not.toContain("<script>");
    // Only '<' needs escaping - that's what a browser's parser matches to
    // end a <script> element; '>' is left alone.
    expect(output).toBe('{"name":"Evil\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"}');
  });
});

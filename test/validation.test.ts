import { describe, expect, it } from "vitest";
import { sanitizeHtml, validateLimitParam, validateTokenId } from "../lib/validation";

describe("validation utilities", () => {
  it("sanitizes HTML entities to prevent injection", () => {
    const input = `<script>alert("xss")</script>`;
    expect(sanitizeHtml(input)).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  });

  it("accepts valid token IDs and rejects invalid ones", () => {
    expect(validateTokenId("token_ABC-123")).toBe(true);
    expect(validateTokenId("token.with.dots-123")).toBe(true);
    expect(validateTokenId("token 123")).toBe(false);
    expect(validateTokenId("a".repeat(101))).toBe(false);
  });

  it("rejects suspiciously long limit parameters", () => {
    expect(validateLimitParam("25")).toBe(true);
    expect(validateLimitParam("1".repeat(11))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { parseHttpUrl } from "../../utils/validateUrl";

describe("parseHttpUrl", () => {
  it("accepts http and https URLs and returns the normalized href", () => {
    expect(parseHttpUrl("http://example.com")).toBe("http://example.com/");
    expect(parseHttpUrl("https://example.com/docs")).toBe(
      "https://example.com/docs"
    );
  });

  it("rejects non-http(s) schemes", () => {
    expect(parseHttpUrl("javascript:alert(1)")).toBeNull();
    expect(parseHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(parseHttpUrl("file:///etc/passwd")).toBeNull();
    expect(parseHttpUrl("ftp://example.com")).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(parseHttpUrl("not a url")).toBeNull();
    expect(parseHttpUrl("example.com")).toBeNull();
    expect(parseHttpUrl("")).toBeNull();
  });

  it("rejects non-string values", () => {
    expect(parseHttpUrl(undefined)).toBeNull();
    expect(parseHttpUrl(null)).toBeNull();
    expect(parseHttpUrl(42)).toBeNull();
    expect(parseHttpUrl({})).toBeNull();
  });
});

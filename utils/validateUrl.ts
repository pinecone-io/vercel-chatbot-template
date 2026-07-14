// Validates that a user-supplied value is a well-formed http(s) URL.
//
// Parsing through the WHATWG `URL` constructor and only ever emitting the
// normalized `href` sanitizes the value: anything that is not a string, not a
// parseable URL, or carries a scheme other than http/https (e.g. `javascript:`,
// `data:`, `file:`) is rejected before it can flow into a downstream sink. This
// is the sanitizer that resolves the CodeQL `js/reflected-xss` finding on the
// seed endpoint, where the request body's `url` was previously used unvalidated.
export function parseHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  return parsed.href;
}

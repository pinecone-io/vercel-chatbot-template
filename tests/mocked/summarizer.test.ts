import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { summarizeLongDocument } from "../../seed/summarizer";

const server = setupServer();
const ENDPOINT = "https://api.openai.com/v1/chat/completions";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("summarizeLongDocument", () => {
  it("returns a short document unchanged without calling the API", async () => {
    const calls = vi.fn();
    server.use(
      http.post(ENDPOINT, () => {
        calls();
        return HttpResponse.json({ text: "unused" });
      })
    );

    const doc = "a short document under the four-thousand character threshold";
    const result = await summarizeLongDocument({ document: doc, inquiry: "q" });

    expect(result).toBe(doc);
    expect(calls).not.toHaveBeenCalled();
  });

  it("chunks and summarizes a document longer than 4000 characters", async () => {
    const calls = vi.fn();
    server.use(
      http.post(ENDPOINT, () => {
        calls();
        return HttpResponse.json({ text: "s" });
      })
    );

    const longDoc = "x".repeat(9000);
    const result = await summarizeLongDocument({ document: longDoc, inquiry: "q" });

    expect(typeof result).toBe("string");
    expect(result.length).toBeLessThan(longDoc.length);
    expect(calls.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

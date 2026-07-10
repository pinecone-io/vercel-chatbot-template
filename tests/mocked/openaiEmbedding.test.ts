import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { OpenAIEmbedding } from "../../utils/OpenAIEmbedding";

// Intercept at the network layer (api.openai.com) rather than mocking the module.
// This keeps the test valid across the upcoming OpenAI SDK rewrite (#9): the modern
// SDK still issues an HTTP POST to the same embeddings endpoint under the hood.
const server = setupServer();

beforeAll(() => {
  process.env.OPENAI_API_KEY = "test-key";
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("OpenAIEmbedding", () => {
  it("returns the embedding vector from a successful response", async () => {
    const vector = [0.1, 0.2, 0.3];
    server.use(
      http.post("https://api.openai.com/v1/embeddings", () =>
        HttpResponse.json({ data: [{ embedding: vector }] })
      )
    );

    const result = await OpenAIEmbedding("hello");
    expect(result).toEqual(vector);
  });

  it("sends the request as an authorized JSON POST for the input text", async () => {
    let seenAuth: string | null = null;
    let seenBody: { input?: string } = {};
    server.use(
      http.post("https://api.openai.com/v1/embeddings", async ({ request }) => {
        seenAuth = request.headers.get("authorization");
        seenBody = (await request.json()) as { input?: string };
        return HttpResponse.json({ data: [{ embedding: [0] }] });
      })
    );

    await OpenAIEmbedding("the quick brown fox");
    expect(seenAuth).toBe("Bearer test-key");
    expect(seenBody.input).toBe("the quick brown fox");
  });

  it("throws a descriptive error when the API returns an unparseable payload", async () => {
    server.use(
      http.post("https://api.openai.com/v1/embeddings", () =>
        HttpResponse.json({ error: "rate limited" }, { status: 429 })
      )
    );

    // The helper reads result.data[0].embedding; a payload without `data`
    // triggers a TypeError that it wraps and rethrows.
    await expect(OpenAIEmbedding("hello")).rejects.toThrow(/Error calling OpenAI embedding API/);
  });
});

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { OpenAICompletion } from "../../utils/OpenAICompletion";

const server = setupServer();
const ENDPOINT = "https://api.openai.com/v1/chat/completions";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  delete process.env.AI_TEMP;
  delete process.env.AI_MAX_TOKENS;
  delete process.env.OPENAI_API_ORG;
});
afterAll(() => server.close());

type Payload = {
  model: string;
  messages: { role: string; content: string }[];
  temperature: number;
  max_tokens: number;
  stream: boolean;
  n: number;
};

const capture = () => {
  const seen: { body?: Payload; auth?: string | null; org?: string | null } = {};
  server.use(
    http.post(ENDPOINT, async ({ request }) => {
      seen.body = (await request.json()) as Payload;
      seen.auth = request.headers.get("authorization");
      seen.org = request.headers.get("openai-organization");
      return HttpResponse.json({ choices: [{ text: "ok" }] });
    })
  );
  return seen;
};

describe("OpenAICompletion", () => {
  it("returns the parsed JSON body from the API", async () => {
    server.use(
      http.post(ENDPOINT, () =>
        HttpResponse.json({ choices: [{ text: "a summary" }] })
      )
    );

    const result = await OpenAICompletion("summarize this");
    expect(result).toEqual({ choices: [{ text: "a summary" }] });
  });

  it("wraps the prompt as a system message with model gpt-3.5-turbo", async () => {
    const seen = capture();
    await OpenAICompletion("my prompt");

    expect(seen.body?.model).toBe("gpt-3.5-turbo");
    expect(seen.body?.messages).toEqual([
      { role: "system", content: "my prompt" },
    ]);
    expect(seen.body?.stream).toBe(true);
    expect(seen.body?.n).toBe(1);
  });

  it("defaults temperature to 0.7 and max_tokens to 100", async () => {
    const seen = capture();
    await OpenAICompletion("x");

    expect(seen.body?.temperature).toBe(0.7);
    expect(seen.body?.max_tokens).toBe(100);
  });

  it("reads temperature and max_tokens from the environment", async () => {
    process.env.AI_TEMP = "0.2";
    process.env.AI_MAX_TOKENS = "512";
    const seen = capture();
    await OpenAICompletion("x");

    expect(seen.body?.temperature).toBe(0.2);
    expect(seen.body?.max_tokens).toBe(512);
  });

  it("sends the API key and organization headers", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_API_ORG = "org-7";
    const seen = capture();
    await OpenAICompletion("x");

    expect(seen.auth).toBe("Bearer test-key");
    expect(seen.org).toBe("org-7");
  });
});

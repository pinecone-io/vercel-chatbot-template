import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { OpenAIStream, type OpenAIStreamPayload } from "../../utils/OpenAIStream";

// Intercept at the network layer with a real SSE body so the eventsource-parser
// + fetch streaming path stays covered across upgrades of either dependency.
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  delete process.env.OPENAI_API_ORG;
});
afterAll(() => server.close());

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

const sse = (dataLines: string[]) => {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of dataLines) {
        controller.enqueue(encoder.encode(`data: ${line}\n\n`));
      }
      controller.close();
    },
  });
};

const sseResponse = (dataLines: string[]) =>
  new HttpResponse(sse(dataLines), {
    headers: { "Content-Type": "text/event-stream" },
  });

const drain = async (stream: ReadableStream<Uint8Array>) => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value);
  }
  return out;
};

const delta = (content: string) =>
  JSON.stringify({ choices: [{ delta: { content } }] });

const payload: OpenAIStreamPayload = {
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: "hi" }],
  temperature: 0.7,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  max_tokens: 100,
  stream: true,
  n: 1,
};

describe("OpenAIStream", () => {
  it("concatenates content deltas and closes on [DONE]", async () => {
    server.use(
      http.post(ENDPOINT, () =>
        sseResponse([delta("Hello"), delta(" world"), "[DONE]"])
      )
    );

    const stream = await OpenAIStream(payload);
    expect(await drain(stream)).toBe("Hello world");
  });

  it("drops a leading newline-only prefix delta", async () => {
    // OpenAI's first deltas are often "\n\n"; the helper skips newline-bearing
    // deltas while counter < 2, so the assembled text must omit them.
    server.use(
      http.post(ENDPOINT, () =>
        sseResponse([delta("\n\n"), delta("Answer"), "[DONE]"])
      )
    );

    const stream = await OpenAIStream(payload);
    expect(await drain(stream)).toBe("Answer");
  });

  it("sends the API key and organization headers", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_API_ORG = "org-42";
    let auth: string | null = null;
    let org: string | null = null;
    server.use(
      http.post(ENDPOINT, ({ request }) => {
        auth = request.headers.get("authorization");
        org = request.headers.get("openai-organization");
        return sseResponse(["[DONE]"]);
      })
    );

    await drain(await OpenAIStream(payload));
    expect(auth).toBe("Bearer test-key");
    expect(org).toBe("org-42");
  });

  it("errors the stream when a data frame is not valid JSON", async () => {
    server.use(http.post(ENDPOINT, () => sseResponse(["not-json"])));

    const stream = await OpenAIStream(payload);
    await expect(drain(stream)).rejects.toBeInstanceOf(Error);
  });
});

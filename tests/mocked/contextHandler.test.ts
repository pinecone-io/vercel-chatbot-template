import { beforeEach, describe, expect, it, vi } from "vitest";

const embeddingMock = vi.hoisted(() => vi.fn());
const matchesMock = vi.hoisted(() => vi.fn());
vi.mock("../../utils/OpenAIEmbedding", () => ({ OpenAIEmbedding: embeddingMock }));
vi.mock("../../pages/api/pinecone", () => ({ getMatchesFromEmbeddings: matchesMock }));

import { getContext } from "../../pages/api/context";

const match = (url: string, text: string) => ({ metadata: { url, text } });

describe("getContext", () => {
  beforeEach(() => {
    embeddingMock.mockReset().mockResolvedValue([0.1, 0.2]);
    matchesMock.mockReset();
  });

  it("embeds the message and joins the matched document texts", async () => {
    matchesMock.mockResolvedValue([match("a", "alpha"), match("b", "beta")]);

    const context = await getContext("question", {} as never, "documents");

    expect(embeddingMock).toHaveBeenCalledWith("question");
    expect(context).toBe("alpha\nbeta");
  });

  it("keeps only the first text per url", async () => {
    matchesMock.mockResolvedValue([match("a", "first"), match("a", "second")]);

    const context = await getContext("q", {} as never, "documents");

    expect(context).toBe("first");
  });

  it("truncates the joined context to maxTokens characters", async () => {
    matchesMock.mockResolvedValue([match("a", "x".repeat(50))]);

    const context = await getContext("q", {} as never, "documents", 10);

    expect(context).toHaveLength(10);
  });
});

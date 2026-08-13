import { beforeEach, describe, expect, it, vi } from "vitest";

const crawl = vi.hoisted(() => vi.fn());
const summarize = vi.hoisted(() => vi.fn());
const embedding = vi.hoisted(() => vi.fn());
const createIndexIfNotExists = vi.hoisted(() => vi.fn());
const chunkedUpsert = vi.hoisted(() => vi.fn());
const pineconeInit = vi.hoisted(() => vi.fn());
const pineconeIndex = vi.hoisted(() => vi.fn());

vi.mock("@pinecone-database/pinecone", () => ({
  PineconeClient: class {
    init = pineconeInit;
    Index = pineconeIndex;
  },
}));
vi.mock("../../seed/crawler", () => ({ Crawler: class { crawl = crawl; } }));
vi.mock("../../seed/summarizer", () => ({ summarizeLongDocument: summarize }));
vi.mock("../../utils/OpenAIEmbedding", () => ({ OpenAIEmbedding: embedding }));
vi.mock("../../pages/api/pinecone", () => ({ createIndexIfNotExists, chunkedUpsert }));

import seed from "../../seed/seed";

describe("seed ingestion pipeline", () => {
  beforeEach(() => {
    crawl.mockReset().mockResolvedValue([
      { url: "https://x.test/", content: "hello world" },
    ]);
    summarize.mockReset().mockResolvedValue("a summary");
    embedding.mockReset().mockResolvedValue([0.1, 0.2, 0.3]);
    createIndexIfNotExists.mockReset().mockResolvedValue(undefined);
    chunkedUpsert.mockReset().mockResolvedValue(true);
    pineconeInit.mockReset().mockResolvedValue(undefined);
    pineconeIndex.mockReset().mockReturnValue({ id: "index" });
  });

  it("creates the index, crawls, embeds raw content, and upserts vectors", async () => {
    await seed("https://x.test/", 10, "docs", false);

    expect(createIndexIfNotExists).toHaveBeenCalledWith(expect.anything(), "docs", 1536);
    expect(crawl).toHaveBeenCalledWith("https://x.test/");
    expect(summarize).not.toHaveBeenCalled();
    expect(embedding).toHaveBeenCalledWith("hello world");

    expect(chunkedUpsert).toHaveBeenCalledTimes(1);
    const [, vectors, namespace, chunkSize] = chunkedUpsert.mock.calls[0];
    expect(namespace).toBe("documents");
    expect(chunkSize).toBe(10);
    expect(vectors[0].values).toEqual([0.1, 0.2, 0.3]);
    expect(vectors[0].metadata.url).toBe("https://x.test/");
    expect(vectors[0].metadata.chunk).toBe("hello world");
  });

  it("summarizes page content before embedding when summarize is true", async () => {
    await seed("https://x.test/", 10, "docs", true);

    expect(summarize).toHaveBeenCalledWith({ document: "hello world" });
    expect(embedding).toHaveBeenCalledWith("a summary");
  });
});

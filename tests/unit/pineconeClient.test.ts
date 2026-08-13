import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chunkedUpsert,
  createIndexIfNotExists,
  getMatchesFromEmbeddings,
  waitUntilIndexIsReady,
} from "../../pages/api/pinecone";

// These wrap the @pinecone-database/pinecone SDK but take the client as an
// argument, so a hand-rolled fake exercises the wrapper logic without a live
// index — the coverage that makes a Pinecone SDK upgrade safe to attempt.

describe("chunkedUpsert", () => {
  it("splits vectors into chunks and upserts each with the namespace", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const index = { upsert } as never;
    const vectors = Array.from({ length: 25 }, (_, i) => ({ id: `v${i}`, values: [i] }));

    const ok = await chunkedUpsert(index, vectors as never, "ns", 10);

    expect(ok).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(3);
    const sizes = upsert.mock.calls.map((c) => c[0].upsertRequest.vectors.length);
    expect(sizes).toEqual([10, 10, 5]);
    for (const call of upsert.mock.calls) {
      expect(call[0].upsertRequest.namespace).toBe("ns");
    }
  });

  it("resolves true even when an individual chunk upsert rejects", async () => {
    const upsert = vi.fn().mockRejectedValue(new Error("boom"));
    const index = { upsert } as never;

    await expect(
      chunkedUpsert(index, [{ id: "a", values: [1] }] as never, "ns")
    ).resolves.toBe(true);
  });
});

describe("getMatchesFromEmbeddings", () => {
  beforeEach(() => {
    process.env.PINECONE_INDEX = "docs";
  });
  afterEach(() => {
    delete process.env.PINECONE_INDEX;
  });

  it("returns [] when the configured index does not exist", async () => {
    const pinecone = {
      listIndexes: vi.fn().mockResolvedValue(["other"]),
      Index: vi.fn(),
    } as never;

    const matches = await getMatchesFromEmbeddings([0.1], pinecone, 1, "ns");

    expect(matches).toEqual([]);
    expect((pinecone as { Index: unknown }).Index).not.toHaveBeenCalled();
  });

  it("queries the index and casts match metadata", async () => {
    const query = vi.fn().mockResolvedValue({
      matches: [{ id: "d1", score: 0.9, metadata: { url: "u", text: "t" } }],
    });
    const pinecone = {
      listIndexes: vi.fn().mockResolvedValue(["docs"]),
      Index: vi.fn().mockReturnValue({ query }),
    } as never;

    const matches = await getMatchesFromEmbeddings([0.1, 0.2], pinecone, 3, "ns");

    expect(query).toHaveBeenCalledWith({
      queryRequest: { vector: [0.1, 0.2], topK: 3, includeMetadata: true, namespace: "ns" },
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].metadata).toEqual({ url: "u", text: "t" });
  });

  it("throws a descriptive error when the query fails", async () => {
    const pinecone = {
      listIndexes: vi.fn().mockResolvedValue(["docs"]),
      Index: vi.fn().mockReturnValue({
        query: vi.fn().mockRejectedValue(new Error("upstream")),
      }),
    } as never;

    await expect(
      getMatchesFromEmbeddings([0.1], pinecone, 1, "ns")
    ).rejects.toThrow(/Error querying embeddings/);
  });
});

describe("createIndexIfNotExists", () => {
  it("creates the index and waits for readiness when it is missing", async () => {
    const client = {
      listIndexes: vi.fn().mockResolvedValue([]),
      createIndex: vi.fn().mockResolvedValue({}),
      describeIndex: vi.fn().mockResolvedValue({ status: { ready: true } }),
    } as never;

    await createIndexIfNotExists(client, "docs", 1536);

    const c = client as unknown as {
      createIndex: ReturnType<typeof vi.fn>;
      describeIndex: ReturnType<typeof vi.fn>;
    };
    expect(c.createIndex).toHaveBeenCalledWith({
      createRequest: { name: "docs", dimension: 1536 },
    });
    expect(c.describeIndex).toHaveBeenCalled();
  });

  it("does not create the index when it already exists", async () => {
    const createIndex = vi.fn();
    const client = {
      listIndexes: vi.fn().mockResolvedValue(["docs"]),
      createIndex,
    } as never;

    await createIndexIfNotExists(client, "docs", 1536);

    expect(createIndex).not.toHaveBeenCalled();
  });
});

describe("waitUntilIndexIsReady", () => {
  it("polls describeIndex until the index reports ready", async () => {
    const describeIndex = vi
      .fn()
      .mockResolvedValueOnce({ status: { ready: false } })
      .mockResolvedValueOnce({ status: { ready: true } });
    const client = { describeIndex } as never;

    await waitUntilIndexIsReady(client, "docs");

    expect(describeIndex).toHaveBeenCalledTimes(2);
  });
});

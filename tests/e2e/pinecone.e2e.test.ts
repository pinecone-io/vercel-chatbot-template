import { afterAll, describe, expect, it } from "vitest";

// Live end-to-end test against a real Pinecone project. It self-skips when
// PINECONE_API_KEY is absent so `pnpm test` stays green with no credentials
// (local dev, fork PRs). CI runs it only where the secret is provided.
//
// The Pinecone client is dynamically imported *inside* the test body so nothing
// SDK-specific loads when the test is skipped — this lets the Pinecone v8
// migration (#8) rewrite the client surface here without affecting module load.
const RUN_LIVE = Boolean(process.env.PINECONE_API_KEY);

// A deterministic, unit-length-ish vector of the ada-002 embedding dimension.
const DIMENSION = 1536;
const makeVector = (seed: number) =>
  Array.from({ length: DIMENSION }, (_, i) => Math.sin((i + 1) * seed) * 0.01);

describe.skipIf(!RUN_LIVE)("Pinecone live e2e: create -> upsert -> query -> teardown", () => {
  // Unique per run so parallel/repeated runs never collide on index name.
  const indexName = `e2e-test-${Date.now().toString(36)}`;
  const namespace = "e2e";
  let deleteIndex: (() => Promise<unknown>) | null = null;

  afterAll(async () => {
    // Best-effort teardown of the throwaway index.
    if (deleteIndex) await deleteIndex().catch(() => {});
  });

  it(
    "upserts a vector and retrieves it by similarity",
    async () => {
      const { PineconeClient } = await import("@pinecone-database/pinecone");
      const client = new PineconeClient();
      await client.init({
        environment: process.env.PINECONE_ENVIRONMENT!,
        apiKey: process.env.PINECONE_API_KEY!,
      });

      deleteIndex = () => client.deleteIndex({ indexName });

      await client.createIndex({ createRequest: { name: indexName, dimension: DIMENSION } });

      // Poll for readiness rather than sleeping a fixed amount.
      for (let attempt = 0; attempt < 60; attempt++) {
        const description = await client.describeIndex({ indexName });
        // @ts-ignore - v0.1.6 status typing is loose
        if (description.status?.ready) break;
        await new Promise((r) => setTimeout(r, 2000));
      }

      const index = client.Index(indexName);
      const values = makeVector(1);
      await index.upsert({
        upsertRequest: {
          vectors: [{ id: "doc-1", values, metadata: { url: "https://example.com", text: "hello" } }],
          namespace,
        },
      });

      // Give the write a moment to become queryable, then query.
      let matches: unknown[] = [];
      for (let attempt = 0; attempt < 15; attempt++) {
        const result = await index.query({
          queryRequest: { vector: values, topK: 1, includeMetadata: true, namespace },
        });
        matches = result.matches ?? [];
        if (matches.length > 0) break;
        await new Promise((r) => setTimeout(r, 2000));
      }

      expect(matches.length).toBe(1);
      expect((matches[0] as { id: string }).id).toBe("doc-1");
    },
    180_000 // index creation + readiness can take well over a minute
  );
});

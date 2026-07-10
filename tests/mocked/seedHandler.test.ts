import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub the seed module so the handler can be exercised without a crawler,
// OpenAI, or a live Pinecone index. The point of these tests is the request
// validation, not the downstream ingestion.
// vi.mock is hoisted above module scope, so the mock fn must be created via
// vi.hoisted to be available inside the factory.
const seedMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("../../seed/seed", () => ({ default: seedMock }));

import handler from "../../pages/api/seed";
import { NextRequest } from "next/server";

const post = (body: string) =>
  handler(
    new NextRequest("http://localhost/api/seed", { method: "POST", body }),
    // The handler ignores its second arg; the edge signature just requires one.
    undefined as never
  );

describe("seed API handler", () => {
  beforeEach(() => {
    seedMock.mockClear();
  });

  it("rejects a non-http(s) url with 400 and never calls seed", async () => {
    const res = await post(JSON.stringify({ url: "javascript:alert(1)" }));
    expect(res.status).toBe(400);
    expect(seedMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed body with 400 and never calls seed", async () => {
    const res = await post("not json");
    expect(res.status).toBe(400);
    expect(seedMock).not.toHaveBeenCalled();
  });

  it("rejects a missing url with 400 and never calls seed", async () => {
    const res = await post(JSON.stringify({ notUrl: "x" }));
    expect(res.status).toBe(400);
    expect(seedMock).not.toHaveBeenCalled();
  });

  it("accepts a valid http(s) url and forwards the normalized href to seed", async () => {
    const res = await post(JSON.stringify({ url: "https://example.com/docs" }));
    expect(res.status).toBe(200);
    expect(seedMock).toHaveBeenCalledTimes(1);
    expect(seedMock.mock.calls[0][0]).toBe("https://example.com/docs");
  });
});

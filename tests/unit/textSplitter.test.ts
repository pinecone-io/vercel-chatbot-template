import { describe, expect, it } from "vitest";
import {
  Document,
  RecursiveCharacterTextSplitter,
} from "../../utils/TextSplitter";

describe("Document", () => {
  it("defaults pageContent and metadata when omitted", () => {
    const doc = new Document({ pageContent: "" });
    expect(doc.pageContent).toBe("");
    expect(doc.metadata).toEqual({});
  });

  it("retains provided metadata", () => {
    const doc = new Document({ pageContent: "hi", metadata: { url: "x" } });
    expect(doc.metadata).toEqual({ url: "x" });
  });
});

describe("RecursiveCharacterTextSplitter", () => {
  it("throws when chunkOverlap >= chunkSize", () => {
    expect(
      () => new RecursiveCharacterTextSplitter({ chunkSize: 10, chunkOverlap: 10 })
    ).toThrow(/chunkOverlap/);
  });

  it("returns the whole text as one chunk when it fits under chunkSize", async () => {
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 100, chunkOverlap: 0 });
    const chunks = await splitter.splitText("hello world");
    expect(chunks).toEqual(["hello world"]);
  });

  it("splits long text into multiple chunks, each within chunkSize", async () => {
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 20, chunkOverlap: 0 });
    const paragraphs = Array.from({ length: 6 }, (_, i) => `paragraph number ${i}`).join("\n\n");

    const chunks = await splitter.splitText(paragraphs);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(splitter.chunkSize);
    }
    // No content is lost: every source paragraph survives in some chunk.
    for (let i = 0; i < 6; i++) {
      expect(chunks.some((c) => c.includes(`paragraph number ${i}`))).toBe(true);
    }
  });

  it("attaches line-range loc metadata to created documents", async () => {
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 100, chunkOverlap: 0 });
    const docs = await splitter.createDocuments(["line one\nline two"], [{ url: "src" }]);

    expect(docs.length).toBeGreaterThan(0);
    const loc = docs[0].metadata.loc as { lines: { from: number; to: number } };
    expect(loc.lines.from).toBe(1);
    expect(loc.lines.to).toBeGreaterThanOrEqual(loc.lines.from);
    // Original metadata is preserved alongside the injected loc.
    expect(docs[0].metadata.url).toBe("src");
  });
});

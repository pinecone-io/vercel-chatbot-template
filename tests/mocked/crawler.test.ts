import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Crawler } from "../../seed/crawler";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const html = (body: string) =>
  new HttpResponse(`<html><body>${body}</body></html>`, {
    headers: { "Content-Type": "text/html" },
  });

describe("Crawler", () => {
  it("fetches a page and converts its HTML to markdown", async () => {
    server.use(
      http.get("https://site.test/", () => html("<h1>Title</h1><p>Hello</p>"))
    );

    const pages = await new Crawler(2, 1).crawl("https://site.test/");

    expect(pages).toHaveLength(1);
    expect(pages[0].url).toBe("https://site.test/");
    expect(pages[0].content).toContain("Title");
    expect(pages[0].content).toContain("Hello");
  });

  it("follows links up to maxPages", async () => {
    server.use(
      http.get("https://site.test/", () =>
        html('<a href="/next">next</a><p>first</p>')
      ),
      http.get("https://site.test/next", () => html("<p>second</p>"))
    );

    const pages = await new Crawler(2, 2).crawl("https://site.test/");

    expect(pages.map((p) => p.url)).toEqual([
      "https://site.test/",
      "https://site.test/next",
    ]);
  });

  it("does not descend past maxDepth", async () => {
    server.use(
      http.get("https://site.test/", () =>
        html('<a href="/deep">deep</a><p>root</p>')
      ),
      http.get("https://site.test/deep", () => html("<p>should not fetch</p>"))
    );

    const pages = await new Crawler(0, 5).crawl("https://site.test/");

    expect(pages).toHaveLength(1);
    expect(pages[0].url).toBe("https://site.test/");
  });

  it("returns empty content when a fetch fails", async () => {
    server.use(http.get("https://broken.test/", () => HttpResponse.error()));

    const pages = await new Crawler(2, 1).crawl("https://broken.test/");

    expect(pages).toHaveLength(1);
    expect(pages[0].content).toBe("");
  });
});

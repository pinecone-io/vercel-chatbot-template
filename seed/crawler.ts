import cheerio from 'cheerio';

import { NodeHtmlMarkdown, NodeHtmlMarkdownOptions } from 'node-html-markdown'

interface QueueItem {
  url: string;
  depth: number;
}

interface Page {
  url: string;
  content: string;
}

class Crawler {
  private queue: QueueItem[] = [];
  private seen: Set<string> = new Set();
  private maxDepth: number;
  private maxPages: number;
  public pages: Page[] = [];

  constructor(maxDepth: number = 2, maxPages: number = 1) {
    this.maxDepth = maxDepth;
    this.maxPages = maxPages;
  }

  async crawl(startUrl: string): Promise<Page[]> {
    this.queue.push({ url: startUrl, depth: 0 });

    while (this.queue.length > 0 && this.pages.length < this.maxPages) {
      const { url, depth } = this.queue.shift() as QueueItem;
      console.log(url, depth)
      if (depth > this.maxDepth) continue;

      if (this.seen.has(url)) continue;

      this.seen.add(url);

      const html = await this.fetchPage(url);
      const text = NodeHtmlMarkdown.translate(html)
      // console.log("TEXT", text)
      this.pages.push({ url, content: text });

      const newUrls = this.extractUrls(html, url);

      this.queue.push(...newUrls.map(newUrl => ({ url: newUrl, depth: depth + 1 })));
    }
    return this.pages;
  }

  private async fetchPage(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      return await response.text();
    } catch (error) {
      // @ts-ignore
      console.error(`Failed to fetch ${url}: ${error.message}`);
      return '';
    }
  }

  private extractUrls(html: string, baseUrl: string): string[] {
    const $ = cheerio.load(html);
    const relativeUrls = $('a').map((i, link) => $(link).attr('href')).get() as string[];
    return relativeUrls.map(relativeUrl => new URL(relativeUrl, baseUrl).href);
  }
}

export { Crawler };
export type { Page };

type Metadata = Record<string, unknown>;

interface DocumentInput {
  pageContent: string;
  metadata?: Metadata;
}

export class Document implements DocumentInput {
  pageContent: string;
  metadata: Metadata;

  constructor(fields: DocumentInput) {
    this.pageContent = fields.pageContent || "";
    this.metadata = fields.metadata || {};
  }
}

interface TextSplitterParams {
  chunkSize: number;
  chunkOverlap: number;
}

export abstract class TextSplitter implements TextSplitterParams {
  chunkSize = 1000;

  chunkOverlap = 200;

  constructor(fields?: Partial<TextSplitterParams>) {
    this.chunkSize = fields?.chunkSize ?? this.chunkSize;
    this.chunkOverlap = fields?.chunkOverlap ?? this.chunkOverlap;
    if (this.chunkOverlap >= this.chunkSize) {
      throw new Error("Cannot have chunkOverlap >= chunkSize");
    }
  }

  abstract splitText(text: string): Promise<string[]>;

  private getNewLinesCount(text: string): number {
    return (text.match(/\n/g) || []).length;
  }

  private getLoc(metadata: Metadata, from: number, to: number): Metadata {
    const loc = metadata.loc && typeof metadata.loc === "object"
      ? { ...metadata.loc }
      : {};

    return {
      ...metadata,
      loc: {
        ...loc,
        lines: { from, to }
      }
    };
  }

  private getIntermediateNewLines(text: string, prevChunk: string, chunk: string): number {
    if (!prevChunk) return 0;

    const indexChunk = text.indexOf(chunk);
    const indexEndPrevChunk = text.indexOf(prevChunk) + prevChunk.length;
    const removedNewlinesFromSplittingText = text.slice(indexEndPrevChunk, indexChunk);

    return this.getNewLinesCount(removedNewlinesFromSplittingText);
  }

  private async createDocumentsFromText(text: string, metadata: Metadata): Promise<Document[]> {
    let lineCounterIndex = 1;
    let prevChunk = null;
    const documents = [];

    for (const chunk of await this.splitText(text)) {
      const intermediateNewLines = this.getIntermediateNewLines(text, prevChunk!, chunk);
      lineCounterIndex += intermediateNewLines;

      const newLinesCount = this.getNewLinesCount(chunk);
      const updatedMetadata = this.getLoc(metadata, lineCounterIndex, lineCounterIndex + newLinesCount);

      documents.push(new Document({ pageContent: chunk, metadata: updatedMetadata }));

      lineCounterIndex += newLinesCount;
      prevChunk = chunk;
    }

    return documents;
  }

  async createDocuments(texts: string[], metadatas: Metadata[] = []): Promise<Document[]> {
    metadatas = metadatas.length > 0 ? metadatas : new Array(texts.length).fill({});
    const documentPromises = texts.map((text, i) => this.createDocumentsFromText(text, metadatas[i]));

    return (await Promise.all(documentPromises)).flat();
  }

  async splitDocuments(documents: Document[]): Promise<Document[]> {
    const selectedDocuments = documents.filter(
      (doc) => doc.pageContent !== undefined
    );
    const texts = selectedDocuments.map((doc) => doc.pageContent);
    const metadatas = selectedDocuments.map((doc) => doc.metadata);
    return this.createDocuments(texts, metadatas);
  }

  private joinDocs(docs: string[], separator: string): string | null {
    const text = docs.join(separator).trim();
    return text === "" ? null : text;
  }

  private warnForExcessChunkSize(total: number): void {
    if (total > this.chunkSize) {
      console.warn(
        `Created a chunk of size ${total}, which is longer than the specified ${this.chunkSize}`
      );
    }
  }

  private createDocAndAdjustCurrentDoc(currentDoc: string[], separator: string, total: number, len: number): string {
    const doc = this.joinDocs(currentDoc, separator);
    while (total > this.chunkOverlap || (total + len > this.chunkSize && total > 0)) {
      total -= currentDoc[0].length;
      currentDoc.shift();
    }
    return doc!;
  }

  mergeSplits(splits: string[], separator: string): string[] {
    const docs: string[] = [];
    let currentDoc: string[] = [];
    let total = 0;

    for (const d of splits) {
      const len = d.length;
      if (total + len >= this.chunkSize) {
        this.warnForExcessChunkSize(total);

        if (currentDoc.length > 0) {
          const doc = this.createDocAndAdjustCurrentDoc(currentDoc, separator, total, len);
          if (doc !== null) {
            docs.push(doc);
          }
        }
      }

      currentDoc.push(d);
      total += len;
    }

    const doc = this.joinDocs(currentDoc, separator);
    if (doc !== null) {
      docs.push(doc);
    }

    return docs;
  }

}

interface CharacterTextSplitterParams extends TextSplitterParams {
  separator: string;
}

interface RecursiveCharacterTextSplitterParams extends TextSplitterParams {
  separators: string[];
}

export class RecursiveCharacterTextSplitter extends TextSplitter implements RecursiveCharacterTextSplitterParams {
  separators: string[] = ["\n\n", "\n", " ", ""];

  constructor(fields?: Partial<RecursiveCharacterTextSplitterParams>) {
    super(fields);
    this.separators = fields?.separators ?? this.separators;
  }

  async splitText(text: string): Promise<string[]> {
    const finalChunks: string[] = [];

    let separator: string = this.separators[this.separators.length - 1];
    for (const s of this.separators) {
      if (s === "") {
        separator = s;
        break;
      }
      if (text.includes(s)) {
        separator = s;
        break;
      }
    }

    let splits: string[];
    if (separator) {
      splits = text.split(separator);
    } else {
      splits = text.split("");
    }

    let goodSplits: string[] = [];
    for (const s of splits) {
      if (s.length < this.chunkSize) {
        goodSplits.push(s);
      } else {
        if (goodSplits.length) {
          const mergedText = this.mergeSplits(goodSplits, separator);
          finalChunks.push(...mergedText);
          goodSplits = [];
        }
        const otherInfo = await this.splitText(s);
        finalChunks.push(...otherInfo);
      }
    }
    if (goodSplits.length) {
      const mergedText = this.mergeSplits(goodSplits, separator);
      finalChunks.push(...mergedText);
    }
    return finalChunks;
  }

  mergeSplits(splits: string[], separator: string): string[] {
    const mergedText: string[] = [];
    let currentChunk = "";
    for (const s of splits) {
      if (currentChunk.length + s.length < this.chunkSize) {
        currentChunk += s + separator;
      } else {
        mergedText.push(currentChunk.trim());
        currentChunk = s + separator;
      }
    }
    if (currentChunk) {
      mergedText.push(currentChunk.trim());
    }
    return mergedText;
  }
}



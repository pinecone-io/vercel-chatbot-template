import { NextApiRequest, NextApiResponse } from "next";
import { PineconeClient, Vector } from "@pinecone-database/pinecone";
import { Crawler, Page } from './crawler'

import { summarizeLongDocument } from "./summarizer";
import { RecursiveCharacterTextSplitter, Document } from "../utils/TextSplitter";
import { OpenAIEmbedding } from "../utils/OpenAIEmbedding";
import { chunkedUpsert, createIndexIfNotExists } from "../pages/api/pinecone";



let pinecone: PineconeClient | null = null

const initPineconeClient = async () => {
  pinecone = new PineconeClient();
  console.log("init pinecone")
  await pinecone.init({
    environment: process.env.PINECONE_ENVIRONMENT!,
    apiKey: process.env.PINECONE_API_KEY!,
  });
}


// The TextEncoder instance enc is created and its encode() method is called on the input string.
// The resulting Uint8Array is then sliced, and the TextDecoder instance decodes the sliced array in a single line of code.
const truncateStringByBytes = (str: string, bytes: number) => {
  const enc = new TextEncoder();
  return new TextDecoder("utf-8").decode(enc.encode(str).slice(0, bytes));
};

export default async function seed(url: string, limit: number, indexName: string, summarize: boolean) {

  const crawlLimit = limit || 100;
  const pineconeIndexName = indexName as string
  const shouldSummarize = summarize === true

  if (!pinecone) {
    await initPineconeClient();
  }

  await createIndexIfNotExists(pinecone!, pineconeIndexName, 1536)

  const crawler = new Crawler(1, crawlLimit)
  const pages = await crawler.crawl(url) as Page[]

  const documents = await Promise.all(pages.map(async row => {

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 256,
      chunkOverlap: 10
    })
    const pageContent = shouldSummarize ? await summarizeLongDocument({ document: row.content }) : row.content

    const docs = await splitter.splitDocuments([
      new Document({ pageContent, metadata: { url: row.url, text: truncateStringByBytes(pageContent, 36000) } }),
    ]);

    return docs
  }))

  const index = pinecone && pinecone.Index(pineconeIndexName);


  let counter = 0

  //Embed the documents
  const getEmbedding = async (doc: Document) => {
    const embedding = await OpenAIEmbedding(doc.pageContent)
    counter = counter + 1
    return {
      id: crypto.randomUUID(),
      values: embedding,
      metadata: {
        chunk: doc.pageContent,
        text: doc.metadata.text as string,
        url: doc.metadata.url as string,
      }
    } as Vector
  }

  console.log("done embedding");

  let vectors = [] as Vector[]

  try {
    vectors = await Promise.all(documents.flat().map((doc) => getEmbedding(doc))) as unknown as Vector[]
    try {
      await chunkedUpsert(index!, vectors, 'documents', 10)
      console.log("done upserting")
    } catch (e) {
      console.log(e)
      console.error({ message: `Error ${JSON.stringify(e)}` })
    }
  } catch (e) {
    console.log(e)
  }
}
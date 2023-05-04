import { NextApiRequest, NextApiResponse } from "next";
import { PineconeClient, Vector } from "@pinecone-database/pinecone";
import { Crawler, Page } from './crawler'

import Bottleneck from "bottleneck";
import { summarizeLongDocument } from "./summarizer";
import { RecursiveCharacterTextSplitter, Document } from "../utils/TextSplitter";
import { OpenAIEmbedding } from "../utils/OpenAIEmbedding";

const limiter = new Bottleneck({
  minTime: 50
});

let pinecone: PineconeClient | null = null

const initPineconeClient = async () => {
  pinecone = new PineconeClient();
  console.log("init pinecone")
  await pinecone.init({
    environment: process.env.PINECONE_ENVIRONMENT!,
    apiKey: process.env.PINECONE_API_KEY!,
  });
}

type Response = {
  message: string
}


// The TextEncoder instance enc is created and its encode() method is called on the input string.
// The resulting Uint8Array is then sliced, and the TextDecoder instance decodes the sliced array in a single line of code.
const truncateStringByBytes = (str: string, bytes: number) => {
  const enc = new TextEncoder();
  return new TextDecoder("utf-8").decode(enc.encode(str).slice(0, bytes));
};


const sliceIntoChunks = (arr: Vector[], chunkSize: number) => {
  return Array.from({ length: Math.ceil(arr.length / chunkSize) }, (_, i) =>
    arr.slice(i * chunkSize, (i + 1) * chunkSize)
  );
};

export default async function summarize(urls: string, limit: number, indexName: string, summmarize: boolean) {


  const urlList = urls.split(",");
  const crawlLimit = limit || 100;
  const pineconeIndexName = indexName as string || "crawl"
  const shouldSummarize = summmarize === true

  if (!pinecone) {
    await initPineconeClient();
  }

  const crawler = new Crawler(urlList, crawlLimit, 200)
  const pages = await crawler.start() as Page[]

  const documents = await Promise.all(pages.map(async row => {

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 256,
      chunkOverlap: 10
    })
    const pageContent = shouldSummarize ? await summarizeLongDocument({ document: row.text }) : row.text

    const docs = splitter.splitDocuments([
      new Document({ pageContent, metadata: { url: row.url, text: truncateStringByBytes(pageContent, 36000) } }),
    ]);
    return docs
  }))

  console.log(documents.length)

  const index = pinecone && pinecone.Index(pineconeIndexName);


  let counter = 0

  //Embed the documents
  const getEmbedding = async (doc: Document) => {
    const embedding = await OpenAIEmbedding(doc.pageContent)
    console.log(doc.pageContent)
    console.log("got embedding", embedding.length)
    process.stdout.write(`${Math.floor((counter / documents.flat().length) * 100)}%\r`)
    counter = counter + 1
    return {
      // id: uuid(),
      values: embedding,
      metadata: {
        chunk: doc.pageContent,
        text: doc.metadata.text as string,
        url: doc.metadata.url as string,
      }
    } as Vector
  }
  const rateLimitedGetEmbedding = limiter.wrap(getEmbedding);
  process.stdout.write("100%\r")
  console.log("done embedding");

  let vectors = [] as Vector[]

  try {
    vectors = await Promise.all(documents.flat().map((doc) => rateLimitedGetEmbedding(doc))) as unknown as Vector[]
    const chunks = sliceIntoChunks(vectors, 10)
    console.log(chunks.length)


    try {
      await Promise.all(chunks.map(async chunk => {
        await index!.upsert({
          upsertRequest: {
            vectors: chunk as Vector[],
            namespace: ""
          }
        })
      }))

      console.log("done upserting")
    } catch (e) {
      console.log(e)
      console.error({ message: `Error ${JSON.stringify(e)}` })
    }
  } catch (e) {
    console.log(e)
  }
}

const run = async () => {
  await summarize("https://www.pinecone.io", 1, "crawl", false)
}

run()
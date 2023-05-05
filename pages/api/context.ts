import { PineconeClient } from "@pinecone-database/pinecone";
import { OpenAIEmbedding } from "../../utils/OpenAIEmbedding";
import { Metadata, getMatchesFromEmbeddings } from "./pinecone";

export const getContext = async (message: string, pinecone: PineconeClient, namespace: string, maxTokens = 3000) => {
  const embedding = await OpenAIEmbedding(message)
  const matches = await getMatchesFromEmbeddings(embedding, pinecone!, 1, namespace)

  const docs = matches && Array.from(
    matches.reduce((map, match) => {
      const metadata = match.metadata as Metadata;
      const { text, url } = metadata;
      if (!map.has(url)) {
        map.set(url, text);
      }
      return map;
    }, new Map())
  ).map(([_, text]) => text);

  console.log("matches", matches)

  return docs.join("\n").substring(0, maxTokens)
}
import { PineconeClient, ScoredVector } from "@pinecone-database/pinecone";

export type Metadata = {
  url: string,
  text: string,
  chunk: string,
}

let pinecone: PineconeClient | null = null;

export const initPineconeClient = async () => {
  if (!pinecone) {
    pinecone = new PineconeClient();
    await pinecone.init({
      environment: process.env.PINECONE_ENVIRONMENT!,
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }
  return pinecone
}

const getMatchesFromEmbeddings = async (embeddings: number[], pinecone: PineconeClient, topK: number): Promise<ScoredVector[]> => {
  const index = pinecone!.Index(process.env.PINECONE_INDEX!);
  const queryRequest = {
    vector: embeddings,
    topK,
    includeMetadata: true
  }
  try {
    const queryResult = await index.query({
      queryRequest
    })
    return queryResult.matches?.map(match => ({
      ...match,
      metadata: match.metadata as Metadata
    })) || []
  } catch (e) {
    console.log("Error querying embeddings: ", e)
    throw (new Error(`Error querying embeddings: ${e}`,))
  }
}

export { getMatchesFromEmbeddings }
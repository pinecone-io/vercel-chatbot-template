import { PineconeClient, ScoredVector } from "@pinecone-database/pinecone";
import { IndexMeta, Vector, VectorOperationsApi } from "@pinecone-database/pinecone/dist/pinecone-generated-ts-fetch";

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

export const waitUntilIndexIsReady = async (
  client: PineconeClient,
  indexName: string
) => {
  try {
    const indexDescription: IndexMeta = await client.describeIndex({
      indexName,
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (!indexDescription.status?.ready) {
      process.stdout.write(".");
      await new Promise((r) => setTimeout(r, 1000));
      await waitUntilIndexIsReady(client, indexName);
    } else {
      return;
    }
  } catch (e) {
    console.error("Error waiting until index is ready", e);
  }
};

// Creates an index if it doesn't exist
export const createIndexIfNotExists = async (
  client: PineconeClient,
  indexName: string,
  dimension: number
) => {
  try {
    const indexList = await client.listIndexes();
    if (!indexList.includes(indexName)) {
      console.log("Creating index", indexName);
      await client.createIndex({
        createRequest: {
          name: indexName,
          dimension,
        },
      });
      console.log("Waiting until index is ready...");
      await waitUntilIndexIsReady(client, indexName);
      console.log("Index is ready.");
    }
  } catch (e) {
    console.error("Error creating index", e);
  }
};

const sliceIntoChunks = <T>(arr: T[], chunkSize: number) => {
  return Array.from({ length: Math.ceil(arr.length / chunkSize) }, (_, i) =>
    arr.slice(i * chunkSize, (i + 1) * chunkSize)
  );
};

// Upserts vectors into the index in chunks
export const chunkedUpsert = async (
  index: VectorOperationsApi,
  vectors: Vector[],
  namespace: string,
  chunkSize = 10
) => {
  // Split the vectors into chunks
  const chunks = sliceIntoChunks<Vector>(vectors, chunkSize);

  try {
    // Upsert each chunk of vectors into the index
    await Promise.allSettled(
      chunks.map(async (chunk) => {
        try {
          await index.upsert({
            upsertRequest: {
              vectors: chunk as Vector[],
              namespace,
            },
          });
        } catch (e) {
          console.log("Error upserting chunk", e);
        }
      })
    );

    return true;
  } catch (e) {
    throw new Error(`Error upserting vectors into index: ${e}`);
  }
};

const getMatchesFromEmbeddings = async (embeddings: number[], pinecone: PineconeClient, topK: number, namespace: string): Promise<ScoredVector[]> => {
  const indexes = await pinecone.listIndexes()

  console.log(indexes.includes(process.env.PINECONE_INDEX!))

  if (!indexes.includes(process.env.PINECONE_INDEX!)) {
    return []
  }


  const index = pinecone!.Index(process.env.PINECONE_INDEX!);
  const queryRequest = {
    vector: embeddings,
    topK,
    includeMetadata: true,
    namespace
  }
  try {
    const queryResult = await index.query({
      queryRequest,
    })
    console.log(queryResult)
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
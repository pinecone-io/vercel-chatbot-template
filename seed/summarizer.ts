import Bottleneck from "bottleneck";
import { OpenAICompletion } from "../utils/OpenAICompletion";

const limiter = new Bottleneck({
  minTime: 5050
});

const chunkSubstr = (str: string, size: number) => {
  const numChunks = Math.ceil(str.length / size)
  const chunks = new Array(numChunks)

  for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substr(o, size)
  }

  return chunks
}

const summarize = async ({ document, inquiry, onSummaryDone }: { document: string, inquiry?: string, onSummaryDone?: Function }) => {
  console.log("summarizing ", document.length)

  const payload = `Summarize the following document so that it satisfies on the inquiry below:
  INQUIRY: ${inquiry}
  DOCUMENT: ${document}
  `
  try {
    const result = await OpenAICompletion(payload)
    onSummaryDone && onSummaryDone(result.text)
    return result
  } catch (e) {
    console.log(e)
  }
}

const rateLimitedSummarize = limiter.wrap(summarize)

const summarizeLongDocument = async ({ document, inquiry, onSummaryDone }: { document: string, inquiry?: string, onSummaryDone?: Function }): Promise<string> => {
  // Chunk document into 4000 character chunks

  try {
    if ((document.length) > 4000) {
      console.log("document is long and has to be shortened", document.length)
      const chunks = chunkSubstr(document, 4000)
      let summarizedChunks: string[] = []
      summarizedChunks = await Promise.all(
        chunks.map(async (chunk) => {
          let result
          if (inquiry) {
            result = await rateLimitedSummarize({ document: chunk, inquiry, onSummaryDone })
          } else {
            result = await rateLimitedSummarize({ document: chunk, onSummaryDone })
          }
          return result
        })
      )

      const result = summarizedChunks.join("\n");
      console.log(result.length)

      if (result.length > 4000) {
        console.log("document is STILL long and has to be shortened further")
        return await summarizeLongDocument({ document: result, inquiry, onSummaryDone })
      } else {
        console.log("done")
        return result
      }

    } else {
      return document
    }
  } catch (e) {
    throw new Error(e as string)
  }
}

export { summarizeLongDocument }
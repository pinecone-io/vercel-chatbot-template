import Bottleneck from "bottleneck";
import { OpenAIPayload } from "../utils/OpenAICompletion";

// const llm = new OpenAI({ concurrency: 10, temperature: 0, modelName: "gpt-3.5-turbo" });

// const { summarizerTemplate, summarizerDocumentTemplate } = templates;

const payload: OpenAIPayload = {
  model: 'gpt-4',
  messages: [{
    role: 'system',
    content: 'Hello, how are you?'
  }],
  temperature: process.env.AI_TEMP ? parseFloat(process.env.AI_TEMP) : 0.7,
  max_tokens: process.env.AI_MAX_TOKENS
    ? parseInt(process.env.AI_MAX_TOKENS)
    : 100,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  stream: true,
  n: 1,
}



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
  // const promptTemplate = new PromptTemplate({
  //   template: inquiry ? summarizerTemplate : summarizerDocumentTemplate,
  //   inputVariables: inquiry ? ["document", "inquiry"] : ["document"],
  // });
  // const chain = new LLMChain({
  //   prompt: promptTemplate,
  //   llm
  // })

  try {
    // const result = await chain.call({
    //   prompt: promptTemplate,
    //   document,
    //   inquiry
    // })

    // console.log(result)

    // onSummaryDone && onSummaryDone(result.text)
    // return result.text
  } catch (e) {
    console.log(e)
  }
}

const rateLimitedSummarize = limiter.wrap(summarize)

const summarizeLongDocument = async ({ document, inquiry, onSummaryDone }: { document: string, inquiry?: string, onSummaryDone?: Function }): Promise<string> => {
  // Chunk document into 4000 character chunks
  const templateLength = inquiry ? summarizerTemplate.length : summarizerDocumentTemplate.length
  try {
    if ((document.length + templateLength) > 4000) {
      console.log("document is long and has to be shortened", document.length)
      const chunks = chunkSubstr(document, 4000 - templateLength - 1)
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

      if ((result.length + templateLength) > 4000) {
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
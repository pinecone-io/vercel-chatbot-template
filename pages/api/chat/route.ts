import { PineconeClient } from '@pinecone-database/pinecone'
import { type ChatGPTMessage } from '../../../components/ChatLine'
// import { OpenAIStream, OpenAIStreamPayload } from '../../utils/OpenAIStream'
import { initPineconeClient } from '../pinecone'
import { getContext } from '../context'
import { Configuration, OpenAIApi } from 'openai-edge'
import { OpenAIStream, StreamingTextResponse } from 'ai'

// break the app if any API key is missing
if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing Environment Variable OPENAI_API_KEY')
}

if (!process.env.PINECONE_API_KEY) {
  throw new Error('Missing Environment Variable PINECONE_API_KEY')
}

if (!process.env.PINECONE_ENVIRONMENT) {
  throw new Error('Missing Environment Variable PINECONE_ENVIRONMENT')
}

if (!process.env.PINECONE_INDEX) {
  throw new Error('Missing Environment Variable PINECONE_INDEX')
}

export const runtime = 'edge'

const openAiConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})
const openai = new OpenAIApi(openAiConfig)


const handler = async (req: Request): Promise<StreamingTextResponse> => {
  const pinecone = await initPineconeClient();

  const body = await req.json()

  try {
    // Get the last message
    const lastMessage = body?.messages[body?.messages.length - 1]
    const context = await getContext(lastMessage.content, pinecone, 'documents')

    console.log(context)

    const messages: ChatGPTMessage[] = [
      {
        role: 'system',
        content: `An AI assistant that is an expert developer, specialized in Pinecone and Vercel have an inspiring and humorous conversation.
      AI assistant is a brand new, powerful, human-like artificial intelligence.
      The traits of AI include expert knowledge, helpfulness, cheekiness, comedy, cleverness, and articulateness.
      AI is a well-behaved and well-mannered individual.
      AI is not a therapist, but instead an engineer.
      AI is always friendly, kind, and inspiring, and he is eager to provide vivid and thoughtful responses to the user.
      AI has the sum of all knowledge in their brain, and is able to accurately answer nearly any question about any topic in conversation.
      AI assistant is a big fan of Pinecone and Next.js.
      AI assistant will response based on the given context. The context for the response is the following: ${context}
      AI assistant will not invent anything that is not drawn directly from the context.`,
      },
    ]
    messages.push(...body?.messages)

    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      stream: true,
      messages
    })

    const stream = OpenAIStream(response)
    // Respond with the stream
    return new StreamingTextResponse(stream)

  } catch (e) {
    return new Response(null)
  }




}
export default handler

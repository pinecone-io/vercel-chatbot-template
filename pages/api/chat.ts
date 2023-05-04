import { PineconeClient } from '@pinecone-database/pinecone'
import { type ChatGPTMessage } from '../../components/ChatLine'
import { OpenAIStream, OpenAIStreamPayload } from '../../utils/OpenAIStream'
import { initPineconeClient } from './pinecone'
import { getContext } from './context'

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

export const config = {
  runtime: 'edge',
}

const handler = async (req: Request): Promise<Response> => {
  const pinecone = await initPineconeClient();

  const body = await req.json()

  try {
    // Get the last message
    const lastMessage = body?.messages[body?.messages.length - 1]
    const context = await getContext(lastMessage.content, pinecone)

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

    const payload: OpenAIStreamPayload = {
      model: 'gpt-4',
      messages: messages,
      temperature: process.env.AI_TEMP ? parseFloat(process.env.AI_TEMP) : 0.7,
      max_tokens: process.env.AI_MAX_TOKENS
        ? parseInt(process.env.AI_MAX_TOKENS)
        : 100,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      stream: true,
      user: body?.user,
      n: 1,
    }

    const stream = await OpenAIStream(payload)
    return new Response(stream)
  } catch (e) {
    return new Response(null)
  }




}
export default handler

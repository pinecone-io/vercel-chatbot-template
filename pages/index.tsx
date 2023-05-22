import { Layout, Text, Page } from "@vercel/examples-ui";
import { Chat } from "../components/Chat";
import { Pinecone } from "../components/Pinecone";

function Home() {
  return (
    <Page className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <Text variant="h1">Pinecone with OpenAI usage example</Text>
        <Text className="text-zinc-600">
          In the example provided, we`&apos;`ve crafted a straightforward
          chatbot utilizing the capabilities of Next.js, OpenAI and Pinecone.
          This chatbot serves as an interactive tool, ready to answer your
          inquiries about the topics listed below. To initiate the conversation,
          start by posing a question to the bot.
        </Text>
        <Text className="text-zinc-600">
          Then, you can enhance the chatbot`&apos;`s understanding by clicking
          the respective buttons to seed relevant information into the Pinecone
          index. Once the index is updated, pose a similar question to the bot
          to witness its improved comprehension and response accuracy.
        </Text>
      </section>

      <section className="flex flex-col gap-3">
        <Pinecone />
        <div className="lg">
          <Chat />
        </div>
      </section>
    </Page>
  );
}

Home.Layout = Layout;

export default Home;

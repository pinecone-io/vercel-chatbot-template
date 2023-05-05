import seed from "../../seed/seed"
import { NextApiRequest, NextApiResponse } from "next"

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { url } = await req.body
  await seed(url, 1, process.env.PINECONE_INDEX!, false)
  res.send({ message: "done" })
}

export default handler
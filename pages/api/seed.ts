import seed from "../../seed/seed"



export const config = {
  runtime: 'edge', // this is a pre-requisite
}

const handler = async (req: Request, res: Response) => {
  const { url } = await new Response(req.body).json();
  console.log("URL!!", url)
  await seed(url, 1, process.env.PINECONE_INDEX!, false)
  return Response.json({ message: "done" })
}

export default handler
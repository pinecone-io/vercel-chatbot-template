import seed from "../../seed/seed"
import { NextRequest, NextResponse } from 'next/server';


export const config = {
  runtime: 'edge', // this is a pre-requisite
}

const handler = async (req: NextRequest, res: NextResponse) => {
  const { url } = await new Response(req.body).json();
  await seed(url, 1, process.env.PINECONE_INDEX!, false)
  return NextResponse.json({ message: "done" })
}

export default handler
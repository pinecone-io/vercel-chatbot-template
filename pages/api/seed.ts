import seed from "../../seed/seed"
import { NextRequest, NextResponse } from 'next/server';
import { parseHttpUrl } from "../../utils/validateUrl";


export const config = {
  runtime: 'edge', // this is a pre-requisite
}

const handler = async (req: NextRequest, res: NextResponse) => {
  let body: unknown;
  try {
    body = await new Response(req.body).json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate/sanitize the user-supplied URL before it reaches the crawler.
  // parseHttpUrl rejects non-string, malformed, and non-http(s) input, so only
  // a normalized http(s) href is ever passed downstream.
  const url = parseHttpUrl((body as { url?: unknown } | null)?.url);
  if (!url) {
    return NextResponse.json(
      { error: "`url` must be a valid http(s) URL" },
      { status: 400 }
    );
  }

  await seed(url, 1, process.env.PINECONE_INDEX!, false)
  return NextResponse.json({ message: "done" })
}

export default handler
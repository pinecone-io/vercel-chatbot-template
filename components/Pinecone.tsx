import clsx from "clsx";
import { Button } from "./Button";
import React from "react";
import { Spinner } from "./Spinner";

export function Pinecone({ className, ...props }: any) {
  const [entries, setSeeded] = React.useState([
    {
      url: "https://vercel.com/docs/concepts/functions/edge-functions/vercel-edge-package",
      title: "@vercel/edge Package",
      seeded: false,
      loading: false,
    },
    {
      url: "https://docs.pinecone.io/docs/manage-indexes",
      title: "Managing Pinecone Indexes",
      seeded: false,
      loading: false,
    },
    {
      url: "https://www.espn.com/nfl/story/_/id/37421059/giants-give-dt-dexter-lawrence-90-million-4-year-extension",
      title: "Dexter Lawrence 4 year extension",
      seeded: false,
      loading: false,
    },
  ]);

  const getDocument = async (url: string) => {
    setSeeded((seeded: any) =>
      seeded.map((seed: any) => {
        if (seed.url === url) {
          return {
            ...seed,
            loading: true,
          };
        }
        return seed;
      })
    );
    const response = await fetch("/api/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await response.json();
    setSeeded((seeded: any) =>
      seeded.map((seed: any) => {
        if (seed.url === url) {
          return {
            ...seed,
            seeded: true,
            loading: false,
          };
        }
        return seed;
      })
    );
  };

  return (
    <>
      {entries.map((entry: any) => {
        return (
          <Button
            style={{
              backgroundColor: entry.seeded ? "green" : "bg-zinc-400",
            }}
            key={entry.url}
            onClick={async () => {
              await getDocument(entry.url);
            }}
          >
            {entry.title}
            {entry.loading && <Spinner />}
          </Button>
        );
      })}
    </>
  );
}

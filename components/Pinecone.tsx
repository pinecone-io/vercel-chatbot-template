import clsx from "clsx";
import { Button } from "./Button";
import React from "react";

export function Pinecone({ className, ...props }: any) {
  const [entries, setSeeded] = React.useState([
    {
      url: "https://www.nature.com/articles/d41586-023-01486-z",
      title: "Mind reading machines are here (May 2023)",
      seeded: false,
    },
    {
      url: "https://mars.nasa.gov/news/9281/curiosity-mars-rover-reaches-long-awaited-salty-region/",
      title:
        "Curiosity Mars Rover Reaches Long-Awaited Salty Region (October 2022)",
      seeded: false,
    },
    {
      url: "https://www.espn.com/nfl/story/_/id/37421059/giants-give-dt-dexter-lawrence-90-million-4-year-extension",
      title: "Dexter Lawrence 4 year extension",
      seeded: false,
    },
  ]);

  const getDocument = async (url: string) => {
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
          </Button>
        );
      })}
    </>
  );
}

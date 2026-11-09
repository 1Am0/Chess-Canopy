"use client";

import { Download, Filter, Trees, Zap } from "lucide-react";
import { ImportForm } from "@/components/players/ImportForm";

const STEPS = [
  { icon: Download, title: "Import", text: "Pull your games from chess.com or Lichess, or drop a PGN / JSON file." },
  { icon: Zap, title: "Explore", text: "Play moves on the board and see how you actually score from every position." },
  { icon: Filter, title: "Filter", text: "Slice by color, result, time control, rating, date or opponent." },
];

export function Welcome() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center gap-10 px-4 py-10 sm:py-16">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Trees className="size-6" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your openings, from your own games</h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Chess Canopy builds an opening explorer out of the games you have played. Everything runs in your browser; your games never leave it.
        </p>
      </div>

      <div className="w-full max-w-md rounded-xl border bg-card p-5 shadow-xs">
        <ImportForm idPrefix="welcome" />
      </div>

      <ol className="grid w-full gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-xl border p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-xs tabular-nums">{i + 1}</span>
              <s.icon className="size-4 text-muted-foreground" />
              {s.title}
            </div>
            <p className="text-sm text-muted-foreground">{s.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

"use client";

import { ImportForm } from "@/components/players/ImportForm";

export function Welcome() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-10 pb-10 sm:px-6 sm:pt-16">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Explore the openings you play
      </h1>
      <p className="mt-3 text-base text-muted-foreground">
        Import your games to see how you score from every position. Your games
        stay in your browser.
      </p>
      <section
        aria-label="Import games"
        className="mt-8 rounded-lg border border-border bg-card p-4 sm:p-5"
      >
        <ImportForm idPrefix="welcome" />
      </section>
      <footer className="mt-auto pt-10 text-xs text-muted-foreground">
        MIT licensed
      </footer>
    </main>
  );
}

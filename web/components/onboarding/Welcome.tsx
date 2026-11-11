"use client";

import { Logo } from "@/components/layout/Logo";
import { Kicker } from "@/components/field";
import { SpecimenPlate } from "@/components/onboarding/SpecimenPlate";
import { ImportForm } from "@/components/players/ImportForm";

const STEPS = [
  {
    numeral: "I",
    title: "Import",
    text: "Pull your games from chess.com or Lichess, or drop a PGN / JSON file.",
  },
  {
    numeral: "II",
    title: "Explore",
    text: "Play moves on the board and see how you actually score from every position.",
  },
  {
    numeral: "III",
    title: "Filter",
    text: "Switch between White and Black, then slice by result, time control, rating, date or opponent.",
  },
];

// Content is never hidden waiting for motion: a short settle (opacity starts at 0.7), off under prefers-reduced-motion.
const enter =
  "motion-safe:animate-in motion-safe:fade-in-70 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200";

function Plate() {
  return (
    <>
      <SpecimenPlate className="flex-1" />
      <p className="mt-3 text-sm text-muted-foreground">Wider ribbon = played more often</p>
    </>
  );
}

/**
 * The landing page: headline panel, import form panel, the sample tree, and three steps.
 */
export function Welcome() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pt-8 pb-8 sm:px-8 sm:pt-10 sm:pb-10">
      <div className="grid gap-8 lg:grid-cols-2 lg:grid-rows-[auto_1fr_auto]">
        <div
          className={`relative isolate lg:col-start-1 lg:row-start-1 ${enter}`}
        >
          <section className="rounded-lg border border-border bg-card px-5 py-6 sm:px-9 sm:py-9">
            <div className="flex items-center gap-2">
              <Logo className="size-5 text-primary" />
              <Kicker className="mb-0 text-xs">
                A field guide to your own openings
              </Kicker>
            </div>
            <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-tight text-ink min-[400px]:text-5xl sm:text-6xl">
              Your openings,{" "}
              from your own games
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Chess Canopy builds an opening explorer out of the games you have
              played. Everything runs in your browser; your games never leave
              it.
            </p>
          </section>
        </div>

        <div
          className={`relative isolate lg:col-start-1 lg:row-start-2 ${enter}`}
        >
          <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
            <div className="mb-4 border-b border-border pb-2">
              <Kicker className="mb-0">Accession</Kicker>
            </div>
            <ImportForm idPrefix="welcome" />
          </section>
        </div>
        <ol
          className={`grid gap-8 md:grid-cols-3 lg:col-span-2 lg:row-start-3 ${enter}`}
        >
          {STEPS.map((s) => (
            <li key={s.title} className="relative">
              <div className="h-full rounded-lg border border-border bg-card px-4 py-5">
                <p aria-hidden className="mb-1 text-xs font-medium text-muted-foreground">
                  Step {s.numeral}
                </p>
                <h2 className="text-sm font-semibold text-foreground">
                  {s.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {s.text}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div
          className={`flex min-w-0 flex-col lg:col-start-2 lg:row-span-2 lg:row-start-1 ${enter}`}
        >
          <Plate />
        </div>
      </div>

      <p className="mt-8 text-center">
        <span className="text-xs text-muted-foreground">
          Runs entirely in your browser · nothing uploaded · MIT
        </span>
      </p>
    </div>
  );
}

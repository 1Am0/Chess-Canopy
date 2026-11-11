"use client";

import { Logo } from "@/components/layout/Logo";
import { Kicker } from "@/components/field";
import { Handnote, PaperLabel, PaperSheet, PhotoCorners, Tape, UnderSheet } from "@/components/paper";
import { SpecimenPlate } from "@/components/onboarding/SpecimenPlate";
import { ImportForm } from "@/components/players/ImportForm";

const STEPS = [
  { numeral: "I", title: "Import", text: "Pull your games from chess.com or Lichess, or drop a PGN / JSON file." },
  { numeral: "II", title: "Explore", text: "Play moves on the board and see how you actually score from every position." },
  { numeral: "III", title: "Filter", text: "Switch between White and Black, then slice by result, time control, rating, date or opponent." },
];

// CSS-only entrance (tw-animate-css); off under prefers-reduced-motion. Opacity/transform only.
const enter = "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-500 motion-safe:fill-mode-backwards";

/**
 * The landing page as a scrapbook spread on the desk: the headline on a cream sheet over an under-sheet, the import form on
 * an index card, the specimen plate as a print held by photo corners, the steps as numbered paper tabs, one pencil note.
 */
export function Welcome() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pt-9 pb-10 sm:px-8 sm:pt-12 sm:pb-14">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
        <div className="min-w-0 space-y-9 lg:col-span-7">
          <div className={`relative isolate motion-safe:delay-75 ${enter}`}>
            <UnderSheet seed="welcome-head" dx={6} dy={7} rotate={-0.8} />
            <PaperSheet as="section" className="px-5 py-6 sm:px-9 sm:py-9">
              <Tape variant="ochre" length={110} angle={-3} seed="welcome-a" className="-top-2.5 left-[8%]" />
              <div className="flex items-center gap-2">
                <Logo className="size-5 text-primary" />
                <Kicker className="mb-0 text-xs">A field guide to your own openings</Kicker>
              </div>
              <h1 className="mt-3 font-serif text-4xl leading-[1.04] font-semibold tracking-tight text-ink [font-variation-settings:'opsz'_72] min-[400px]:text-5xl sm:text-6xl">
                Your openings, <em className="font-normal">from your own games</em>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Chess Canopy builds an opening explorer out of the games you have played. Everything runs in your browser; your games never leave it.
              </p>
            </PaperSheet>
          </div>

          <div className={`relative isolate max-w-lg motion-safe:delay-200 ${enter}`}>
            <UnderSheet seed="welcome-form" dx={5} dy={6} rotate={0.7} />
            <PaperSheet as="section" className="p-4 sm:p-5">
              <Tape variant="sage" length={92} angle={2.5} seed="welcome-b" className="-top-2.5 right-[10%]" />
              <div className="mb-4 border-b-[1.5px] border-margin pb-2">
                <Kicker className="mb-0">Accession</Kicker>
              </div>
              <ImportForm idPrefix="welcome" />
            </PaperSheet>
          </div>
        </div>

        <div className={`min-w-0 lg:col-span-5 lg:pt-12 motion-safe:delay-300 ${enter}`}>
          <div className="relative isolate">
            <UnderSheet seed="welcome-mat" dx={5} dy={6} rotate={0.7} />
            <PaperSheet className="p-4 sm:p-6">
              <Tape variant="ochre" length={96} angle={2} seed="welcome-c" className="-top-2.5 left-[34%]" />
              <div className="relative">
                <SpecimenPlate />
                <PhotoCorners />
              </div>
            </PaperSheet>
          </div>
          <Handnote seed="plate-note" rotate={-2} className="mt-6 ml-[22%] block w-fit text-[20px]" arrow={{ x1: -10, y1: 2, x2: -42, y2: -22 }}>
            wider ribbon = played more often
          </Handnote>
        </div>
      </div>

      <ol className={`mt-16 grid gap-9 sm:mt-20 md:grid-cols-3 md:gap-7 motion-safe:delay-500 ${enter}`}>
        {STEPS.map((s) => (
          <li key={s.title} className="relative">
            <PaperSheet className="h-full px-4 pt-7 pb-5">
              <PaperLabel aria-hidden tone="manila" taped className="absolute -top-3 left-4 text-xs">
                Step {s.numeral}
              </PaperLabel>
              <h2 className="label-caps text-sm text-foreground">{s.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </PaperSheet>
          </li>
        ))}
      </ol>

      <p className="mt-12 text-center">
        <PaperLabel className="label-caps text-[11px] font-sans whitespace-normal text-muted-foreground">
          Runs entirely in your browser · nothing uploaded · MIT
        </PaperLabel>
      </p>
    </div>
  );
}

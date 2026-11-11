"use client";

import { Logo } from "@/components/layout/Logo";
import { SpecimenPlate } from "@/components/onboarding/SpecimenPlate";
import { ImportForm } from "@/components/players/ImportForm";

const STEPS = [
  { numeral: "I", title: "Import", text: "Pull your games from chess.com or Lichess, or drop a PGN / JSON file." },
  { numeral: "II", title: "Explore", text: "Play moves on the board and see how you actually score from every position." },
  { numeral: "III", title: "Filter", text: "Switch between White and Black, then slice by result, time control, rating, date or opponent." },
];

// CSS-only entrance (tw-animate-css); off under prefers-reduced-motion. Opacity/transform only.
const enter = "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-500 motion-safe:fill-mode-backwards";

export function Welcome() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-14">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="min-w-0 space-y-6 lg:col-span-7">
          <div className={`flex items-center gap-2 ${enter}`}>
            <Logo className="size-5 text-primary" />
            <p className="label-caps text-sm">A field guide to your own openings</p>
          </div>
          <h1 className={`font-serif text-5xl leading-[1.02] font-semibold tracking-tight text-ink [font-variation-settings:'opsz'_72] sm:text-6xl motion-safe:delay-75 ${enter}`}>
            Your openings, <em className="font-normal">from your own games</em>
          </h1>
          <p className={`max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg motion-safe:delay-150 ${enter}`}>
            Chess Canopy builds an opening explorer out of the games you have played. Everything runs in your browser; your games never leave it.
          </p>
          <div className={`max-w-lg border border-rule bg-card p-4 sm:p-5 motion-safe:delay-200 ${enter}`}>
            <ImportForm idPrefix="welcome" />
          </div>
        </div>

        <div className={`min-w-0 lg:col-span-5 lg:pt-10 motion-safe:delay-300 ${enter}`}>
          <SpecimenPlate />
        </div>
      </div>

      <ol className={`mt-12 grid border-t border-rule-strong sm:mt-16 md:grid-cols-3 md:gap-x-8 motion-safe:delay-500 ${enter}`}>
        {STEPS.map((s) => (
          <li key={s.title} className="grid grid-cols-[2.75rem_1fr] gap-x-2 border-b border-rule py-4 md:border-b-0">
            <span aria-hidden="true" className="font-serif text-3xl leading-none text-primary italic">{s.numeral}</span>
            <div className="min-w-0">
              <h2 className="label-caps text-sm text-foreground">{s.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="label-caps mt-10 text-center text-xs">Runs entirely in your browser · nothing uploaded · MIT</p>
    </div>
  );
}

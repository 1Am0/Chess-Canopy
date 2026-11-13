"use client";

import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Kicker } from "@/components/field";
import {
  Handnote,
  PaperSheet,
  Tape,
  UnderSheet,
} from "@/components/paper";
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

// Each sheet settles in once on first load, staggered by --i (see .settle in app/shell.css). Off under reduced motion.
const enter = "settle";
const at = (i: number, rot = 0) => ({ "--i": i, "--settle-rot": `${rot}deg` }) as React.CSSProperties;

function Plate() {
  return (
    <>
      <div className="relative isolate flex min-h-0 flex-1 flex-col">
        <UnderSheet seed="welcome-mat" dx={5} dy={6} rotate={0.7} />
        <PaperSheet className="flex min-h-0 flex-1 flex-col p-4 sm:p-5 lg:p-4">
          <Tape
            variant="ochre"
            length={96}
            angle={2}
            seed="welcome-c"
            className="-top-2.5 left-[34%]"
          />
          <div className="relative flex min-h-0 flex-1 flex-col">
            <SpecimenPlate className="flex-1" />
          </div>
        </PaperSheet>
      </div>
      <Handnote
        seed="plate-note"
        rotate={-2}
        className="mt-6 ml-[22%] block w-fit text-[20px] lg:mt-4"
        arrow={{ x1: -10, y1: 2, x2: -42, y2: -22 }}
      >
        wider ribbon = played more often
      </Handnote>
    </>
  );
}

/**
 * The landing page as a scrapbook spread on the desk: the headline on a cream sheet over an under-sheet, the import form on
 * an index card, the specimen plate as a print held by photo corners, the steps as numbered paper tabs, one pencil note.
 */
export function Welcome() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pt-8 pb-8 sm:px-8 sm:pt-10 sm:pb-10 lg:max-w-[1400px] lg:px-6 lg:pt-6 lg:pb-5">
      <div className="grid gap-8 lg:flex-1 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-5 lg:grid-rows-[auto_minmax(auto,1fr)_auto]">
        <div className={`relative isolate lg:col-start-1 lg:row-start-1 ${enter}`} style={at(0, -0.6)}>
          <UnderSheet seed="welcome-head" dx={6} dy={7} rotate={-0.8} />
          <PaperSheet as="section" className="px-5 py-6 sm:px-9 sm:py-9 lg:py-5">
            <Tape variant="ochre" length={110} angle={-3} seed="welcome-a" className="-top-2.5 left-[8%]" />
            <div className="flex items-center gap-2">
              <Logo className="size-5 text-primary" />
              <Kicker className="mb-0 text-xs">A field guide to your own openings</Kicker>
            </div>
            <h1 className="mt-3 font-serif text-4xl leading-[1.04] font-semibold tracking-tight text-ink [font-variation-settings:'opsz'_72] min-[400px]:text-5xl sm:text-6xl lg:text-5xl">
              Your openings, <em className="font-normal">from your own games</em>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mt-3 lg:text-base lg:[@media(max-height:800px)]:hidden">
              Chess Canopy builds an opening explorer out of the games you have played, and shows how you actually score from every position.
            </p>
          </PaperSheet>
        </div>

        {/* the focal point: the import form, on the biggest, brightest sheet */}
        <div className={`relative isolate lg:col-start-1 lg:row-start-2 lg:self-start ${enter}`} style={at(1, 0.5)}>
          <UnderSheet seed="welcome-form" dx={5} dy={6} rotate={0.7} />
          <PaperSheet as="section" aria-labelledby="welcome-import-title" className="p-4 sm:p-6 lg:p-5">
            <Tape variant="sage" length={92} angle={2.5} seed="welcome-b" className="-top-2.5 right-[10%]" />
            <h2 id="welcome-import-title" className="mb-4 border-b-[1.5px] border-margin pb-2 font-serif text-2xl leading-tight font-semibold tracking-tight lg:mb-3">
              Import your games
            </h2>
            <ImportForm idPrefix="welcome" />
            <p className="mt-3 flex items-start gap-2 text-sm leading-snug text-muted-foreground">
              <ShieldCheck className="mt-px size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>Runs entirely in your browser. Your games are never uploaded.</span>
            </p>
          </PaperSheet>
        </div>

        <div className={`flex min-h-0 min-w-0 flex-col lg:col-start-2 lg:row-span-2 lg:row-start-1 ${enter}`} style={at(2, -0.4)}>
          <Plate />
        </div>

        {/* three quiet notes, not cards: they should not compete with the form */}
        <ol className={`grid gap-4 md:grid-cols-3 lg:col-span-2 lg:row-start-3 lg:gap-8 ${enter}`} style={at(3)}>
          {STEPS.map((s) => (
            <li key={s.title} className="flex gap-3 border-t border-dashed border-rule-strong/70 pt-3">
              <span aria-hidden className="font-serif text-lg leading-6 text-primary italic">
                {s.numeral}.
              </span>
              <div className="min-w-0">
                <h2 className="label-caps text-xs text-foreground">{s.title}</h2>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground lg:mt-3">Free and open source (MIT).</p>
    </div>
  );
}

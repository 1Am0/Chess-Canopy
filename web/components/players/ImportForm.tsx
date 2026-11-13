"use client";

import { useRef, useState } from "react";
import type { ImportRequest } from "@/lib/engine/types";
import { useSharedImport } from "@/components/players/ImportProvider";
import { ImportProgress } from "@/components/players/ImportProgress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Envelope } from "@/components/paper";

const tabCls = "px-0.5 text-xs sm:px-3 sm:text-sm";

type Tab = "chess.com" | "lichess" | "pgn" | "json";

/**
 * Default JSON player label from the file name, so unlabelled imports of different
 * files don't all merge into one player: strips the extension and the web export's
 * "chess.com-" / "lichess-" prefix ("chess.com-hikaru.json" -> "hikaru").
 */
export function labelFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/^(chess\.com|lichess|pgn|json)-/i, "").trim();
  return base || "cli";
}

function FileDrop({ accept, label, file, onFile }: { accept: string; label: string; file: File | null; onFile: (f: File | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  // A manila envelope: the flap lifts while a file hovers over it, the file name sits in the pocket's clear band.
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFile(e.dataTransfer.files?.[0] ?? null);
      }}
    >
      <Envelope open={over} className="min-h-48 gap-2 px-4 pt-[4.75rem] pb-[3.25rem]">
        <p className={file ? "max-w-full truncate" : "label-caps text-[11px] text-foreground"}>
          {file ? <span className="font-mono text-xs text-foreground">{file.name}</span> : label}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}>
          {file ? "Change file" : "Choose file"}
        </Button>
      </Envelope>
      <input ref={input} type="file" accept={accept} className="sr-only" aria-label={label} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </div>
  );
}

export function ImportForm({ initialTab = "chess.com", onDone, idPrefix = "imp" }: { initialTab?: Tab; onDone?: () => void; idPrefix?: string }) {
  const { progress, running, start, cancel } = useSharedImport();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [username, setUsername] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const isFile = tab === "pgn" || tab === "json";
  const canSubmit = !running && (isFile ? !!file && (tab === "json" || !!username.trim()) : !!username.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    let req: ImportRequest;
    if (isFile) {
      const f = file as File;
      req = tab === "pgn" ? { kind: "pgn", username: username.trim(), file: f } : { kind: "json", username: username.trim() || labelFromFileName(f.name), file: f };
    } else {
      req = { kind: tab as "chess.com" | "lichess", username: username.trim() };
    }
    const out = await start(req);
    if (out) {
      setUsername("");
      setFile(null);
      onDone?.();
    }
  };

  const userId = `${idPrefix}-user`;
  return (
    <form onSubmit={submit} className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => { setTab(v as Tab); setFile(null); }}>
        <TabsList className="grid w-full grid-cols-[1.4fr_1fr_.75fr_.75fr] gap-1 bg-transparent max-sm:h-11 sm:h-10 sm:grid-cols-4">
          <TabsTrigger value="chess.com" disabled={running} className={tabCls}>Chess.com</TabsTrigger>
          <TabsTrigger value="lichess" disabled={running} className={tabCls}>Lichess</TabsTrigger>
          <TabsTrigger value="pgn" disabled={running} className={tabCls}>PGN</TabsTrigger>
          <TabsTrigger value="json" disabled={running} className={tabCls}>JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="chess.com" className="text-sm text-muted-foreground">
          Fetches your public games straight from chess.com in your browser.
        </TabsContent>
        <TabsContent value="lichess" className="text-sm text-muted-foreground">
          Streams your public games straight from Lichess in your browser.
        </TabsContent>
        <TabsContent value="pgn" className="space-y-3">
          <FileDrop accept=".pgn,text/plain" label="Drop a .pgn file here" file={file} onFile={setFile} />
        </TabsContent>
        <TabsContent value="json" className="space-y-3">
          <FileDrop accept=".json,application/json" label="Drop a JSON file exported by the Python CLI" file={file} onFile={setFile} />
        </TabsContent>
      </Tabs>

      <div className="space-y-1.5">
        <Label htmlFor={userId} className="label-caps">
          {tab === "pgn" ? "Your username in these games" : tab === "json" ? "Player label (optional)" : "Username"}
        </Label>
        <Input
          id={userId}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={
            tab === "lichess"
              ? "e.g. DrNykterstein"
              : tab === "chess.com"
                ? "e.g. hikaru"
                : tab === "json" && file
                  ? `Defaults to "${labelFromFileName(file.name)}"`
                  : "username"
          }
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={running}
        />
      </div>

      {progress && <ImportProgress progress={progress} onCancel={cancel} />}

      <Button type="submit" size="lg" className="w-full max-sm:h-11" disabled={!canSubmit}>
        {running ? "Importing…" : "Import games"}
      </Button>
    </form>
  );
}

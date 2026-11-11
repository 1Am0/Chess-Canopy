"use client";

import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import type { ImportRequest } from "@/lib/engine/types";
import { useSharedImport } from "@/components/players/ImportProvider";
import { ImportProgress } from "@/components/players/ImportProgress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Index tabs: inactive = specimen ground, active = raised card with a primary top rule.
const tabCls =
  "rounded-t-sm rounded-b-none border border-b-0 border-rule bg-specimen font-mono text-xs uppercase tracking-wider data-[state=active]:border-rule-strong data-[state=active]:border-t-2 data-[state=active]:border-t-primary data-[state=active]:border-b-0 data-[state=active]:bg-card";

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
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed border-rule-strong bg-specimen/40 p-1.5 text-center text-sm transition-colors forced-colors:border-[GrayText]",
        over && "border-primary bg-accent",
      )}
    >
      <div className="ruled flex w-full flex-col items-center justify-center gap-2 rounded-[1px] px-4 py-5 [--rule-gap:1.25rem]">
        <FileUp className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className={file ? "max-w-full truncate" : "label-caps text-xs"}>{file ? <span className="font-mono text-xs text-foreground">{file.name}</span> : label}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}>
          Choose file
        </Button>
      </div>
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
        <TabsList className="grid w-full grid-cols-4 gap-1 bg-transparent">
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

      <Button type="submit" className="w-full" disabled={!canSubmit}>
        {running ? "Importing…" : "Import games"}
      </Button>
    </form>
  );
}

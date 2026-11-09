"use client";

import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import type { ImportRequest } from "@/lib/engine/types";
import { useImport } from "@/hooks/use-import";
import { ImportProgress } from "@/components/players/ImportProgress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Tab = "chess.com" | "lichess" | "pgn" | "json";

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
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center text-sm transition-colors",
        over && "border-primary bg-accent",
      )}
    >
      <FileUp className="size-6 text-muted-foreground" />
      <p className="text-muted-foreground">{file ? <span className="font-medium text-foreground">{file.name}</span> : label}</p>
      <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}>
        Choose file
      </Button>
      <input ref={input} type="file" accept={accept} className="sr-only" aria-label={label} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </div>
  );
}

export function ImportForm({ initialTab = "chess.com", onDone, idPrefix = "imp" }: { initialTab?: Tab; onDone?: () => void; idPrefix?: string }) {
  const { progress, running, start, cancel } = useImport();
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
      let text: string;
      try {
        text = await (file as File).text();
      } catch {
        toast.error("Could not read that file");
        return;
      }
      req = tab === "pgn" ? { kind: "pgn", username: username.trim(), text } : { kind: "json", username: username.trim() || "cli", text };
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="chess.com" disabled={running}>Chess.com</TabsTrigger>
          <TabsTrigger value="lichess" disabled={running}>Lichess</TabsTrigger>
          <TabsTrigger value="pgn" disabled={running}>PGN</TabsTrigger>
          <TabsTrigger value="json" disabled={running}>JSON</TabsTrigger>
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
        <Label htmlFor={userId}>
          {tab === "pgn" ? "Your username in these games" : tab === "json" ? "Player label (optional)" : "Username"}
        </Label>
        <Input
          id={userId}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={tab === "lichess" ? "e.g. DrNykterstein" : tab === "chess.com" ? "e.g. hikaru" : "username"}
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

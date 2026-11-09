"use client";

import { createContext, useContext } from "react";
import { useImport } from "@/hooks/use-import";

type ImportApi = ReturnType<typeof useImport>;

const ImportContext = createContext<ImportApi | null>(null);

/**
 * One import controller for the whole app. The import dialog, the player manager and the
 * header indicator all share it, so progress and Cancel survive closing the dialog and a
 * second import can't be started while one is running.
 */
export function ImportProvider({ children }: { children: React.ReactNode }) {
  const api = useImport();
  return <ImportContext.Provider value={api}>{children}</ImportContext.Provider>;
}

export function useSharedImport(): ImportApi {
  const ctx = useContext(ImportContext);
  if (!ctx) throw new Error("useSharedImport must be used inside <ImportProvider>");
  return ctx;
}

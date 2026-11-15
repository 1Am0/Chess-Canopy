import type { Metadata } from "next";
import { RepertoireShell } from "@/components/repertoire/RepertoireShell";

export const metadata: Metadata = {
  title: "Repertoire · Chess Canopy",
};

export default function RepertoirePage() {
  return <RepertoireShell />;
}

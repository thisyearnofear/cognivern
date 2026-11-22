import type { Metadata } from "next";
import { ProcurementReplay } from "./procurement-replay";

export const metadata: Metadata = {
  title: "Sealed from whom? — Canton procurement replay — Cognivern",
  description:
    "Interactive replay of a verified Canton sandbox run: query the same sealed-bid round as each party and see what the ledger discloses. Synthetic amounts; no wallet, no funds, no live writes.",
};

export default function ProcureDemoPage() {
  return <ProcurementReplay />;
}

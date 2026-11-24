import type { Metadata } from "next";
import { Suspense } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { VerifyClient } from "@/components/verify/verify-client";
import { isValidReportId } from "@/lib/diligence-report";

type SearchParams = {
  id?: string;
  round?: string;
  report?: string;
  case?: string;
  model?: string;
  view?: string;
};

/**
 * Deep links carry ?report=&case=&model=&view= — put the cell's actual
 * outcome in the link preview so a pasted URL pre-sells the flip. The report
 * is a static file under public/, read at request time; any failure falls
 * back to the generic title. (Static og:image stays — no next/og, per the
 * zero-compute link-preview rule in layout.tsx.)
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { report, case: caseParam, model } = await searchParams;
  const fallback: Metadata = {
    title: "Public verification — Cognivern",
    description:
      "Public, login-free verification of anchored credit commitments, sealed-bid auction rounds, and supplier-diligence reports.",
  };
  if (!report || !isValidReportId(report)) return fallback;
  try {
    const raw = await readFile(
      path.join(process.cwd(), "public", "evidence", "diligence", `${report}.json`),
      "utf8",
    );
    const data = JSON.parse(raw) as {
      cases?: {
        supplier?: { name?: string };
        perModel?: {
          label?: string;
          alone?: { decision?: string | null; errored?: boolean };
          governed?: { finalDecision?: string | null };
        }[];
      }[];
    };
    const idx = Number(caseParam);
    const c = Number.isInteger(idx) ? data.cases?.[idx] : undefined;
    const supplier = c?.supplier?.name;
    if (!supplier) return fallback;
    const pm = model
      ? c.perModel?.find((r) => r.label === model)
      : c.perModel?.[0];
    const alone = pm?.alone?.errored ? "no answer" : (pm?.alone?.decision ?? "—");
    const governed = pm?.governed?.finalDecision ?? "—";
    const flip = alone !== governed;
    return {
      title: `${supplier} · ${model ?? pm?.label ?? "model"}: ${alone} → ${governed} — Cognivern`,
      description: flip
        ? `The model alone decided ${alone}; Cognivern governance, with purchased specialist evidence, decided ${governed}. Inspect the receipts — no login required.`
        : `Both arms decided ${alone} — inspect the evidence and receipts, no login required.`,
    };
  } catch {
    return fallback;
  }
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; round?: string; report?: string }>;
}) {
  const { id, round, report } = await searchParams;
  return (
    <Suspense>
      <VerifyClient
        initialId={id ?? ""}
        initialRoundId={round ?? ""}
        initialReportId={report ?? ""}
        initialMode={report ? "diligence" : round ? "auction" : "credit"}
      />
    </Suspense>
  );
}

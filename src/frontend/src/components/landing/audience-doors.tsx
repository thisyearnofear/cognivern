"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Gift, Lock } from "lucide-react";

/**
 * Band 5 — compact audience doors. The sponsored-cohorts wedge and the
 * procurement rail serve different buyers than the governance narrative,
 * so each gets one compact card here and a full landing of its own.
 */
export function AudienceDoors() {
  return (
    <section className="border-t border-border">
      <div className="max-w-4xl mx-auto px-6 py-14">
        <div className="grid gap-4 sm:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-start gap-4 rounded-xl border border-border bg-card p-5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Gift size={20} />
            </div>
            <div className="min-w-0">
              <h2
                className="text-base font-semibold text-foreground"
                style={{ fontFamily: "var(--font-space-grotesk)" }}
              >
                Running a hackathon?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Sponsor a cohort at cost — metered inference budgets, verifiable receipts.
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-3">
                <Link
                  href="/sponsor"
                  className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                >
                  Sponsor a cohort <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
                <Link
                  href="/credits"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Have a key? Check your credits
                </Link>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="flex items-start gap-4 rounded-xl border border-border bg-card p-5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Lock size={20} />
            </div>
            <div className="min-w-0">
              <h2
                className="text-base font-semibold text-foreground"
                style={{ fontFamily: "var(--font-space-grotesk)" }}
              >
                Procuring with agents?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Confidential sealed-bid vendor selection on Canton, public proof per outcome.
              </p>
              <Link
                href="/procure"
                className="mt-2.5 inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                Procure with agents <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

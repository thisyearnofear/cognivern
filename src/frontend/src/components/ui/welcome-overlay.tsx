"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldCheck,
  Users,
  FileSearch,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoStore } from "@/stores/demo-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useRouter } from "next/navigation";

interface WelcomeCard {
  icon: React.ElementType;
  title: string;
  description: string;
  cta: string;
  href: string;
  color: string;
}

const WELCOME_CARDS: WelcomeCard[] = [
  {
    icon: ShieldCheck,
    title: "Check Governance",
    description: "Test any spend action against your policies in real time",
    cta: "Try a check",
    href: "/governance/check",
    color: "from-sky-500/10 to-sky-500/5 border-sky-200 dark:border-sky-800",
  },
  {
    icon: Users,
    title: "Register an Agent",
    description: "Give an agent a wallet and budget to govern",
    cta: "Create agent",
    href: "/agents/workshop",
    color: "from-violet-500/10 to-violet-500/5 border-violet-200 dark:border-violet-800",
  },
  {
    icon: FileSearch,
    title: "View Audit Trail",
    description: "Every decision is logged — see the full history",
    cta: "Open audit",
    href: "/audit",
    color: "from-amber-500/10 to-amber-500/5 border-amber-200 dark:border-amber-800",
  },
];

const OVERLAY_KEY = "cognivern-welcome-shown";

export function WelcomeOverlay() {
  const [show, setShow] = useState(false);
  const demoMode = useDemoStore((s) => s.demoMode);
  const onboardingCompleted = usePreferencesStore((s) => s.onboardingCompleted);
  const router = useRouter();

  useEffect(() => {
    // Show overlay once: on first visit, after onboarding completes, or in demo mode
    const alreadyShown = sessionStorage.getItem(OVERLAY_KEY);
    if (alreadyShown) return;

    if (demoMode || onboardingCompleted) {
      // Delay slightly to let the page render first
      const timer = setTimeout(() => setShow(true), 600);
      return () => clearTimeout(timer);
    }
  }, [demoMode, onboardingCompleted]);

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem(OVERLAY_KEY, "true");
  };

  const handleNavigate = (href: string) => {
    handleDismiss();
    router.push(href);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="bg-background rounded-2xl border border-border shadow-2xl max-w-lg w-full overflow-hidden"
          >
            {/* Header */}
            <div className="relative p-6 pb-4 text-center border-b border-border">
              <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Dismiss welcome"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3 border border-primary/20">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h2
                className="text-xl font-bold tracking-tight"
                style={{ fontFamily: "var(--font-space-grotesk)" }}
              >
                Welcome to Cognivern
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                {demoMode
                  ? "You're in demo mode — exploring with sample data. Here's where to start:"
                  : "Your treasury is set up. Here are the key places to explore:"}
              </p>
            </div>

            {/* Cards */}
            <div className="p-6 space-y-3">
              {WELCOME_CARDS.map((card, i) => (
                <motion.button
                  key={card.title}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
                  onClick={() => handleNavigate(card.href)}
                  className={`w-full flex items-start gap-4 p-4 rounded-xl border bg-gradient-to-r ${card.color} text-left hover:shadow-md transition-all active:scale-[0.99]`}
                >
                  <div className="p-2 rounded-lg bg-background border border-border/50 shrink-0">
                    <card.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{card.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {card.description}
                    </div>
                  </div>
                  <div className="text-xs font-medium text-primary shrink-0 mt-1">
                    {card.cta} →
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <Button
                onClick={handleDismiss}
                className="w-full"
                variant="default"
              >
                Get started
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

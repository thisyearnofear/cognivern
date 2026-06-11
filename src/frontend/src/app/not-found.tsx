import Link from "next/link";
import { ShieldCheck, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-background text-foreground">
      <div className="p-4 rounded-full bg-muted">
        <ShieldCheck className="h-10 w-10 text-muted-foreground" />
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          404 — Page not found
        </h1>
        <p className="text-muted-foreground max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Go home <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { PitchMark } from "@/components/mark";
import { Academy } from "@/components/academy";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@/lib/auth/gates";

export const Route = createFileRoute("/learn")({ component: LearnPage });

function LearnPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-bg px-4 pb-16">
      <header className="flex items-center justify-between gap-3 py-4">
        <Link to="/" className="flex items-center gap-2">
          <PitchMark className="size-8" />
          <span className="font-display text-lg tracking-wide uppercase">Turf Community</span>
        </Link>
        <SignedOut>
          <Link to="/login">
            <Button size="sm">I run a turf</Button>
          </Link>
        </SignedOut>
        <SignedIn>
          <Link to="/desk">
            <Button size="sm">Open desk</Button>
          </Link>
        </SignedIn>
      </header>
      <Academy />
    </main>
  );
}

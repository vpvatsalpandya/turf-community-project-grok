import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ScreenLoader } from "@/components/screen-loader";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { claimSignupRole, getMyProfile } from "@/lib/turf/server";

export const Route = createFileRoute("/welcome")({ component: Welcome });

function Welcome() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isPending || !user) return;
    const intent =
      typeof window !== "undefined" && window.localStorage.getItem("turf-signup-role") === "owner"
        ? "owner"
        : "player";
    let live = true;
    claimSignupRole({ data: { role: intent } })
      .then(() => getMyProfile())
      .then((p) => {
        if (!live) return;
        if (typeof window !== "undefined") window.localStorage.removeItem("turf-signup-role");
        void navigate({ to: p.home });
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [isPending, user, navigate]);

  if (isPending) {
    return (
      <main className="min-h-dvh bg-bg">
        <ScreenLoader label="Signing you in…" />
      </main>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (failed) return <Navigate to="/play" />;
  return (
    <main className="min-h-dvh bg-bg">
      <ScreenLoader label="Setting up your desk…" />
    </main>
  );
}

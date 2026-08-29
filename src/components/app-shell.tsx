import { useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, ClipboardList, LayoutGrid, MoreHorizontal, PieChart } from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import type { Membership } from "@/lib/turf/types";
import { cn } from "@/lib/utils";
import { Mark } from "./logo";
import { Badge } from "./ui/badge";

const NAV: { to: "/app" | "/app/requests" | "/app/calendar" | "/app/reports" | "/app/more"; label: string; icon: typeof LayoutGrid; exact?: boolean }[] = [
  { to: "/app", label: "Today", icon: LayoutGrid, exact: true },
  { to: "/app/requests", label: "Requests", icon: ClipboardList },
  { to: "/app/calendar", label: "Week", icon: CalendarDays },
  { to: "/app/reports", label: "Reports", icon: PieChart },
  { to: "/app/more", label: "More", icon: MoreHorizontal },
];

export function AppShell({
  children,
  membership,
  requestCount,
  orgBanner,
}: {
  children: React.ReactNode;
  membership: Membership | null;
  requestCount?: number;
  orgBanner?: string | null;
}) {
  const { user, isPending } = useCurrentUserState();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const root = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]');
    root.dataset.theme = "day";
    meta?.setAttribute("content", "#efe8d8");
    return () => {
      delete root.dataset.theme;
      meta?.setAttribute("content", "#07110c");
    };
  }, []);

  if (isPending) {
    return (
      <div data-theme="day" className="grid min-h-dvh place-items-center bg-bg text-base text-muted">
        Opening the desk…
      </div>
    );
  }
  if (!user) return <RedirectToSignIn to="/login" />;

  return (
    <div data-theme="day" className="min-h-dvh bg-bg text-base text-fg">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-3 backdrop-blur">
        <Link to="/app" className="flex items-center gap-2">
          <Mark className="size-7" />
          <span className="font-display text-base font-semibold">
            {membership?.orgName ?? "Turf Community"}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {membership && (
            <Badge tone="neutral">{membership.role.replace("_", " ")}</Badge>
          )}
          <UserButton />
        </div>
      </header>
      {orgBanner && (
        <div className="bg-warn/15 px-4 py-2 text-center text-sm text-warn">{orgBanner}</div>
      )}
      <div className="mx-auto flex max-w-6xl">
        <aside className="sticky top-[57px] hidden h-[calc(100dvh-57px)] w-52 shrink-0 flex-col gap-1 border-r border-border p-3 md:flex">
          {NAV.map((n) => {
            const active = n.exact ? path === n.to : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-lg px-3 text-sm",
                  active ? "bg-surface-3 font-medium" : "text-muted hover:bg-surface-2",
                )}
              >
                <n.icon className="size-4" />
                {n.label}
                {n.to === "/app/requests" && requestCount ? (
                  <span className="ml-auto tabular text-xs text-accent-2">{requestCount}</span>
                ) : null}
              </Link>
            );
          })}
        </aside>
        <main className="min-w-0 flex-1 px-4 py-4 pb-24 md:pb-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((n) => {
          const active = n.exact ? path === n.to : path.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px]",
                active ? "text-accent-2" : "text-muted",
              )}
            >
              <n.icon className="size-5" />
              {n.label}
              {n.to === "/app/requests" && requestCount ? (
                <span className="absolute right-3 top-1 rounded-full bg-accent px-1.5 text-[10px] text-accent-fg">
                  {requestCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { getDeskContext } from "@/lib/server/desk-fns";

export const Route = createFileRoute("/app")({
  component: DeskLayout,
});

function DeskLayout() {
  const q = useQuery({ queryKey: ["desk"], queryFn: () => getDeskContext() });
  const m = q.data?.membership ?? null;
  const banner =
    m?.orgStatus === "read_only"
      ? "Account is read-only — calendar still works, new bookings are paused until the invoice is marked paid."
      : m?.orgStatus === "past_due"
        ? "Payment is past due. The desk still works. We'll pause new bookings in a few days, not mid-weekend."
        : m?.orgStatus === "trialing"
          ? "Trial is running. First month is free unless this account was referred."
          : null;
  return (
    <AppShell membership={m} requestCount={q.data?.requestCount} orgBanner={banner}>
      <Outlet />
    </AppShell>
  );
}

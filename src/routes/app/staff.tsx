import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteStaff, listStaff } from "@/lib/server/setup-fns";

export const Route = createFileRoute("/app/staff")({ component: Staff });

function Staff() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["staff"], queryFn: () => listStaff() });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"staff" | "manager">("staff");
  const inv = useMutation({
    mutationFn: () => inviteStaff({ data: { email, role } }),
    onSuccess: () => {
      toast.success("Invite saved — they get this role on first sign-in");
      setEmail("");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-semibold">Staff</h1>
      <p className="text-sm text-muted">
        They sign in with Google, X, or email + password. Use a Gmail they already have — there is no SMS login. The invite email must match exactly.
      </p>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          inv.mutate();
        }}
      >
        <Input type="email" required placeholder="staff@turf.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select
          className="h-11 rounded-lg bg-surface-2 px-3 shadow-[var(--shadow-border)]"
          value={role}
          onChange={(e) => setRole(e.target.value as "staff" | "manager")}
        >
          <option value="staff">Staff</option>
          <option value="manager">Manager</option>
        </select>
        <Button type="submit">Invite</Button>
      </form>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
        {(q.data?.users ?? []).map((u) => (
          <li key={u.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>
              {u.display_name || u.email} <span className="text-muted">{u.email}</span>
            </span>
            <Badge>{u.role}</Badge>
          </li>
        ))}
        {(q.data?.invites ?? []).map((i) => (
          <li key={i.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>{i.email} (pending)</span>
            <Badge tone="warn">{i.role}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

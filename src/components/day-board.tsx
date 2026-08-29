import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addWaitlist,
  blockSlot,
  listDayBoard,
  lookupCustomer,
  lookupPrice,
  quickCreateBooking,
  transitionBooking,
} from "@/lib/server/desk-fns";
import { getShareMessage } from "@/lib/server/desk-fns";
import { formatInr } from "@/lib/turf/money";
import { durationLabel, formatTime, zonedInstant } from "@/lib/turf/time";
import type { BookingRow, ResourceRow, WaitlistRow } from "@/lib/turf/types";
import { cn } from "@/lib/utils";
import { ShareBox } from "./share-box";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input, Textarea } from "./ui/input";
import { cacheDayBoard, readDayBoard } from "@/lib/offline-board";
import { badgeTone } from "@/lib/turf/reliability";

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6–22

function hourInIst(iso: string): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso)),
  );
}

export function DayBoard({ venueId, date }: { venueId: string; date: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["board", venueId, date],
    queryFn: async () => {
      const data = await listDayBoard({ data: { venueId, date } });
      cacheDayBoard(venueId, date, data);
      return data;
    },
  });
  const cached = q.data ? null : readDayBoard<NonNullable<typeof q.data>>(venueId, date);
  const board = q.data ?? cached?.data;
  const stale = Boolean(!q.data && cached);
  const [creating, setCreating] = useState<{ resource: ResourceRow; hour: number } | null>(null);
  const [active, setActive] = useState<BookingRow | null>(null);

  if (q.isPending && !board) return <p className="text-sm text-muted">Loading the sheet…</p>;
  if (!board) return <p className="text-sm text-danger">Could not load the day.</p>;

  const { resources, bookings, blackouts, noshowIds, waitlist } = board;
  const bookable = resources.filter((r) => r.isBookable);

  return (
    <div className="print-sheet overflow-x-auto rounded-2xl bg-surface shadow-[var(--shadow-border)]">
      {stale && (
        <p className="border-b border-border bg-warn/15 px-3 py-2 text-sm text-warn">
          Offline — showing the last sheet saved on this phone.
        </p>
      )}
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="sticky left-0 bg-surface px-3 py-2 font-medium">Time</th>
            {bookable.map((r) => (
              <th key={r.id} className="px-2 py-2 font-medium">
                {r.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOURS.map((h) => (
            <tr key={h} className="border-t border-border/70">
              <td className="sticky left-0 bg-surface px-3 py-1 font-mono text-xs text-faint tabular">
                {String(h).padStart(2, "0")}:00
              </td>
              {bookable.map((r) => {
                const hits = bookings.filter((b) => {
                  if (b.resourceId !== r.id) return false;
                  return hourInIst(b.periodStart) === h;
                });
                const blocked = blackouts.some((bl) => {
                  if (bl.resourceId !== r.id) return false;
                  return hourInIst(bl.start) === h;
                });
                const waiting = (waitlist ?? []).filter(
                  (w) => w.resourceId === r.id && hourInIst(w.periodStart) === h,
                );
                return (
                  <td key={r.id} className="px-1 py-1 align-top">
                    {hits.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setActive(b)}
                        className={cn(
                          "mb-1 w-full rounded-md px-2 py-1.5 text-left text-xs",
                          b.state === "requested" && "bg-warn/15 text-warn",
                          b.state === "confirmed" && "bg-accent/15 text-accent-2",
                          b.state === "checked_in" && "bg-accent text-accent-fg",
                          b.state === "completed" && "bg-surface-3 text-muted",
                          b.state === "no_show" && "bg-danger/15 text-danger",
                          noshowIds.includes(b.id) && "ring-1 ring-danger",
                        )}
                      >
                        <span className="block truncate font-medium">{b.customerName ?? "Walk-in"}</span>
                        <span className="tabular opacity-80">{formatInr(b.amountDuePaise)}</span>
                      </button>
                    ))}
                    {blocked && (
                      <div className="rounded-md bg-surface-3 px-2 py-1.5 text-[11px] text-muted">Blocked</div>
                    )}
                    {waiting.length > 0 && (
                      <p className="px-1 text-[11px] text-muted">
                        {waiting.length} waiting
                      </p>
                    )}
                    {!hits.length && !blocked && (
                      <button
                        type="button"
                        onClick={() => setCreating({ resource: r, hour: h })}
                        className="h-11 w-full rounded-md text-faint hover:bg-surface-3 hover:text-muted"
                        aria-label={`Add booking ${r.name} ${h}:00`}
                      >
                        +
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {creating && (
        <QuickEntry
          venueId={venueId}
          date={date}
          resource={creating.resource}
          hour={creating.hour}
          onClose={() => setCreating(null)}
          onSaved={() => {
            setCreating(null);
            void qc.invalidateQueries();
          }}
        />
      )}
      {active && (
        <BookingSheet
          booking={active}
          flagged={noshowIds.includes(active.id)}
          waiters={(waitlist ?? []).filter(
            (w) =>
              w.resourceId === active.resourceId &&
              hourInIst(w.periodStart) === hourInIst(active.periodStart),
          )}
          venueId={venueId}
          onClose={() => setActive(null)}
          onChanged={() => {
            setActive(null);
            void qc.invalidateQueries();
          }}
        />
      )}
    </div>
  );
}

function BookingSheet({
  booking,
  flagged,
  waiters,
  venueId,
  onClose,
  onChanged,
}: {
  booking: BookingRow;
  flagged: boolean;
  waiters: WaitlistRow[];
  venueId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [freed, setFreed] = useState<WaitlistRow[]>([]);
  const [wlPhone, setWlPhone] = useState("");
  const [wlName, setWlName] = useState("");
  const mut = useMutation({
    mutationFn: (to: "checked_in" | "completed" | "no_show" | "cancelled") =>
      transitionBooking({ data: { bookingId: booking.id, to } }),
    onSuccess: (r) => {
      if (r.waiters?.length) {
        setFreed(r.waiters);
        if (r.message) setMsg(r.message);
        toast.success("Slot freed — people on the waitlist");
        return;
      }
      if (r.message) setMsg(r.message);
      else onChanged();
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const shareMut = useMutation({
    mutationFn: (kind: "request_confirmed" | "payment_reminder" | "booking_reminder") =>
      getShareMessage({ data: { bookingId: booking.id, kind, language: "hi" } }),
    onSuccess: (r) => setMsg(r.body),
  });
  const addWl = useMutation({
    mutationFn: () =>
      addWaitlist({
        data: {
          venueId,
          resourceId: booking.resourceId,
          startISO: booking.periodStart,
          endISO: booking.periodEnd,
          name: wlName,
          phone: wlPhone,
        },
      }),
    onSuccess: () => {
      toast.success("On the waitlist");
      setWlPhone("");
      setWlName("");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet onClose={onClose} title={booking.refCode}>
      <p className="text-sm text-muted">
        {booking.resourceName} · {formatTime(new Date(booking.periodStart))} – {formatTime(new Date(booking.periodEnd))}
      </p>
      <p className="mt-1 font-medium">
        {booking.customerName}{" "}
        {booking.customerPhone && (
          <a href={`tel:${booking.customerPhone}`} className="text-accent-2">
            {booking.customerPhone}
          </a>
        )}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge>{booking.state.replace("_", " ")}</Badge>
        {booking.reliability && <Badge tone={badgeTone(booking.reliability)}>{booking.reliability}</Badge>}
        {flagged && <Badge tone="bad">No-show candidate</Badge>}
      </div>
      <p className="mt-3 tabular text-sm">
        Due {formatInr(booking.amountDuePaise)} · collected {formatInr(booking.amountCollectedPaise)}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {booking.state === "confirmed" && (
          <Button onClick={() => mut.mutate("checked_in")}>Check in</Button>
        )}
        {booking.state === "checked_in" && (
          <Button onClick={() => mut.mutate("completed")}>Check out</Button>
        )}
        {booking.state === "confirmed" && (
          <Button variant="danger" onClick={() => mut.mutate("no_show")}>
            No-show
          </Button>
        )}
        {(booking.state === "confirmed" || booking.state === "requested") && (
          <Button variant="secondary" onClick={() => mut.mutate("cancelled")}>
            Cancel
          </Button>
        )}
        <Button variant="secondary" onClick={() => shareMut.mutate("request_confirmed")}>
          Message
        </Button>
        {booking.state === "requested" && (
          <Button variant="secondary" onClick={() => shareMut.mutate("payment_reminder")}>
            Pay nudge
          </Button>
        )}
        {(booking.state === "confirmed" || booking.state === "checked_in") && (
          <Button variant="secondary" onClick={() => shareMut.mutate("booking_reminder")}>
            Remind
          </Button>
        )}
      </div>
      {msg && <div className="mt-4"><ShareBox text={msg} /></div>}
      {freed.length > 0 && (
        <div className="mt-4 rounded-xl bg-surface-2 p-3">
          <p className="text-sm font-medium">Waiting for this hour</p>
          <ul className="mt-2 space-y-1 text-sm">
            {freed.map((w) => (
              <li key={w.id}>
                {w.name} · <a href={`tel:${w.phone}`} className="text-accent-2">{w.phone}</a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Copy the waitlist message from More → Waitlist and send it.</p>
        </div>
      )}
      {(booking.state === "confirmed" || booking.state === "checked_in") && (
        <form
          className="mt-4 space-y-2 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            addWl.mutate();
          }}
        >
          <p className="text-sm font-medium">Add to waitlist</p>
          {waiters.length > 0 && (
            <p className="text-xs text-muted">
              {waiters.map((w) => w.name).join(", ")} already waiting.
            </p>
          )}
          <Input placeholder="Phone" inputMode="tel" value={wlPhone} onChange={(e) => setWlPhone(e.target.value)} required />
          <Input placeholder="Name" value={wlName} onChange={(e) => setWlName(e.target.value)} required />
          <Button type="submit" variant="secondary" className="w-full" disabled={addWl.isPending}>
            Wait for this slot
          </Button>
        </form>
      )}
    </Sheet>
  );
}

function QuickEntry({
  venueId,
  date,
  resource,
  hour,
  onClose,
  onSaved,
}: {
  venueId: string;
  date: string;
  resource: ResourceRow;
  hour: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const start = zonedInstant(date, `${String(hour).padStart(2, "0")}:00`);
  const end = zonedInstant(
    hour >= 23 ? date : date,
    `${String(hour + 1).padStart(2, "0")}:00`,
  );
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("upi_offline");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("Rain");
  const [tab, setTab] = useState<"book" | "block" | "wait">("book");

  const priceQ = useQuery({
    queryKey: ["price", resource.id, start.toISOString()],
    queryFn: () =>
      lookupPrice({
        data: { venueId, resourceId: resource.id, startISO: start.toISOString(), endISO: end.toISOString() },
      }),
  });
  const custQ = useQuery({
    queryKey: ["cust", phone],
    enabled: phone.replace(/\D/g, "").length >= 10,
    queryFn: () => lookupCustomer({ data: { venueId, phone } }),
  });

  const filled = custQ.data?.identity;
  const price = priceQ.data?.pricePaise ?? 0;

  const save = useMutation({
    mutationFn: () =>
      quickCreateBooking({
        data: {
          venueId,
          resourceId: resource.id,
          startISO: start.toISOString(),
          endISO: end.toISOString(),
          name: name || filled?.name || "Walk-in",
          phone,
          amountDuePaise: amount ? Math.round(Number(amount) * 100) : price,
          amountCollectedPaise: amount ? Math.round(Number(amount) * 100) : price,
          paymentMode: mode,
          paymentNote: note,
          channel: "staff",
          applyLoyalty: Boolean(filled?.loyaltyCreditPaise),
        },
      }),
    onSuccess: (r) => {
      toast.success("Booked");
      onSaved();
      if (r.message) toast.message("Share text ready");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const wait = useMutation({
    mutationFn: () =>
      addWaitlist({
        data: {
          venueId,
          resourceId: resource.id,
          startISO: start.toISOString(),
          endISO: end.toISOString(),
          name: name || filled?.name || "Waitlist",
          phone,
        },
      }),
    onSuccess: () => {
      toast.success("On the waitlist");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const block = useMutation({
    mutationFn: () =>
      blockSlot({
        data: {
          venueId,
          resourceId: resource.id,
          startISO: start.toISOString(),
          endISO: end.toISOString(),
          reason,
        },
      }),
    onSuccess: () => {
      toast.success("Blocked");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet onClose={onClose} title={`${resource.name} · ${formatTime(start)}`}>
      <div className="mb-3 flex gap-2">
        <Button size="sm" variant={tab === "book" ? "primary" : "secondary"} onClick={() => setTab("book")}>
          Book
        </Button>
        <Button size="sm" variant={tab === "wait" ? "primary" : "secondary"} onClick={() => setTab("wait")}>
          Wait
        </Button>
        <Button size="sm" variant={tab === "block" ? "primary" : "secondary"} onClick={() => setTab("block")}>
          Block
        </Button>
      </div>
      {tab === "block" ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            block.mutate();
          }}
        >
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Rain, maintenance, tournament" />
          <Button type="submit" className="w-full" disabled={block.isPending}>
            Block this hour
          </Button>
        </form>
      ) : tab === "wait" ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            wait.mutate();
          }}
        >
          <p className="text-sm text-muted">They get this hour if the confirmed booking cancels. You send the message yourself.</p>
          <Input
            placeholder="Phone first"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoFocus
          />
          <Input
            placeholder="Name"
            value={name || filled?.name || ""}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Button type="submit" className="w-full" disabled={wait.isPending}>
            {wait.isPending ? "Saving…" : "Add to waitlist"}
          </Button>
        </form>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Input
            placeholder="Phone first"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoFocus
          />
          {filled && (
            <p className="text-xs text-muted">
              {filled.name} · {filled.totalBookings} visits · {formatInr(filled.totalSpendPaise)}
              {filled.loyaltyCreditPaise > 0 ? ` · ${formatInr(filled.loyaltyCreditPaise)} credit` : ""}
            </p>
          )}
          <Input
            placeholder="Name"
            value={name || filled?.name || ""}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            placeholder={price ? `Amount (₹${Math.round(price / 100)})` : "Amount ₹"}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            className="h-11 w-full rounded-lg bg-surface-2 px-3 text-sm shadow-[var(--shadow-border)]"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="upi_offline">UPI</option>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="other">Other</option>
          </select>
          <Textarea placeholder="UPI ref / note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" />
          <p className="text-xs text-muted">{durationLabel(start, end)} · lands as confirmed, no request step</p>
          <Button type="submit" className="w-full" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save booking"}
          </Button>
        </form>
      )}
    </Sheet>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-fg/30 md:items-center">
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-[var(--shadow-border)] md:rounded-3xl">
        <div className="mb-3 flex items-start justify-between">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

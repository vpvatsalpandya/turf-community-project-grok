import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import {
  getWaAccount,
  listWaOutbox,
  saveWaAccount,
  testWaSend,
  type WaAccountPublic,
} from "@/lib/turf/wa";

export function WaConnect({ title }: { title: string }) {
  const [account, setAccount] = useState<WaAccountPublic | null | undefined>(undefined);
  const [outbox, setOutbox] = useState<Awaited<ReturnType<typeof listWaOutbox>>>([]);
  const [provider, setProvider] = useState<"cloud" | "green">("cloud");
  const [token, setToken] = useState("");
  const [instance, setInstance] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [templateOwner, setTemplateOwner] = useState("");
  const [templatePlayer, setTemplatePlayer] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const [a, box] = await Promise.all([getWaAccount(), listWaOutbox()]);
    setAccount(a);
    setOutbox(box);
    if (a) {
      setProvider(a.provider);
      setInstance(a.instance);
      setDisplayPhone(a.displayPhone);
      setTemplateOwner(a.templateOwner);
      setTemplatePlayer(a.templatePlayer);
      setEnabled(a.enabled);
    }
  }

  useEffect(() => {
    reload().catch(() => {});
  }, []);

  if (account === undefined) {
    return <p className="text-sm text-muted">Loading WhatsApp…</p>;
  }
  if (account === null) {
    return (
      <p className="text-sm text-muted">
        Save the turf sheet first. WhatsApp attaches to that ground.
      </p>
    );
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await saveWaAccount({
        data: {
          provider,
          token: token.trim() || undefined,
          instance,
          displayPhone,
          templateOwner,
          templatePlayer,
          verifyToken: verifyToken.trim() || undefined,
          enabled,
        },
      });
      setAccount(saved);
      setToken("");
      setVerifyToken("");
      toast.success(saved.connected ? "WhatsApp connected" : "Saved. Turn it on after the token.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save WhatsApp");
    } finally {
      setBusy(false);
    }
  }

  async function onTest() {
    setBusy(true);
    try {
      const res = await testWaSend({ data: { phone: testPhone } });
      if (res.sent) toast.success("Test ping sent");
      else toast.error(res.error || "Not sent");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl tracking-tight uppercase">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Automatic WhatsApp: a request pings the owner, an ack pings the player, confirm / in /
          out ping the player. Connect Cloud API (Meta) or Green API (scan QR, keep the phone app).
        </p>
        <p className={`mt-2 text-xs font-medium uppercase ${account.connected ? "text-accent" : "text-warn"}`}>
          {account.connected ? "Sending" : "Not sending yet"}
        </p>
      </div>

      <form onSubmit={onSave} className="space-y-3">
        <Field label="Provider" hint="Cloud = official Meta. Green = QR on your turf WhatsApp, works tonight.">
          <Select
            value={provider}
            onChange={(e) => setProvider(e.target.value === "green" ? "green" : "cloud")}
          >
            <option value="cloud">WhatsApp Cloud API (Meta)</option>
            <option value="green">Green API (scan QR)</option>
          </Select>
        </Field>
        <Field
          label={provider === "green" ? "idInstance" : "Phone number ID"}
          hint={
            provider === "green"
              ? "From green-api.com after you scan the QR."
              : "Meta for Developers → WhatsApp → API setup → Phone number ID."
          }
          required
        >
          <Input value={instance} onChange={(e) => setInstance(e.target.value)} required />
        </Field>
        <Field
          label={provider === "green" ? "apiTokenInstance" : "Permanent token"}
          hint={account.tokenSet ? "Saved. Paste again only to replace." : "Paste once. We store it on the turf, not in the browser."}
        >
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={account.tokenSet ? "•••• saved" : ""}
            autoComplete="off"
          />
        </Field>
        <Field label="Sending as (10-digit)" hint="The number players will see the ping from.">
          <Input
            value={displayPhone}
            onChange={(e) => setDisplayPhone(e.target.value)}
            inputMode="numeric"
          />
        </Field>
        {provider === "cloud" ? (
          <>
            <Field
              label="Owner template name"
              hint="Optional. Utility template for first ping to the owner. Leave blank to send session text."
            >
              <Input value={templateOwner} onChange={(e) => setTemplateOwner(e.target.value)} />
            </Field>
            <Field
              label="Player template name"
              hint="Optional. Used for ack / confirm / in / out."
            >
              <Input value={templatePlayer} onChange={(e) => setTemplatePlayer(e.target.value)} />
            </Field>
            <Field
              label="Webhook verify token"
              hint="Any secret string. Paste the same value in Meta → webhook."
            >
              <Input
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                placeholder={account.verifyTokenSet ? "•••• saved" : ""}
              />
            </Field>
          </>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="size-4 accent-accent"
          />
          Send automatically
        </label>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Saving…" : "Save WhatsApp"}
        </Button>
      </form>

      <div className="space-y-2 rounded-lg bg-surface p-4">
        <p className="text-xs tracking-wide text-muted uppercase">Test ping</p>
        <Field label="Mobile" hint="Your own number first.">
          <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} inputMode="numeric" />
        </Field>
        <Button variant="secondary" className="w-full" disabled={busy || !testPhone} onClick={() => void onTest()}>
          Send test
        </Button>
      </div>

      <div>
        <p className="text-xs tracking-wide text-muted uppercase">Last pings</p>
        {outbox.length === 0 ? (
          <p className="mt-2 text-sm text-muted">None yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {outbox.map((row) => (
              <li key={row.id} className="rounded-md bg-surface px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase text-muted">{row.kind}</p>
                  <p className={`text-xs uppercase ${row.status === "sent" ? "text-accent" : "text-warn"}`}>
                    {row.status}
                  </p>
                </div>
                <p className="mt-1 text-xs text-faint">{row.toPhone}</p>
                {row.error ? <p className="mt-1 text-xs text-danger">{row.error}</p> : null}
                <p className="mt-1 line-clamp-3 text-xs text-muted">{row.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

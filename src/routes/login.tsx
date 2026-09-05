import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PitchMark } from "@/components/mark";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { DEMO_LOGINS, type DemoLogin } from "@/lib/turf/demo-logins";
import { getLiveConfig, getMyProfile, prepareDemoLogins } from "@/lib/turf/server";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [demo, setDemo] = useState(false);
  const [signedHome, setSignedHome] = useState<DemoLogin["home"] | null>(null);

  useEffect(() => {
    prepareDemoLogins()
      .then((res) => {
        setDemo(Boolean(res.demo));
        setReady(true);
      })
      .catch(() => setReady(true));
    getLiveConfig()
      .then((c) => setDemo(c.demo))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    getMyProfile()
      .then((p) => setSignedHome(p.home))
      .catch(() => setSignedHome("/desk"));
  }, [user]);

  if (isPending) {
    return <main className="grid min-h-dvh place-items-center bg-bg text-muted">Loading…</main>;
  }
  if (user && signedHome) return <Navigate to={signedHome} />;

  async function goHome() {
    try {
      const p = await getMyProfile();
      await navigate({ to: p.home });
    } catch {
      await navigate({ to: "/desk" });
    }
  }

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "up") {
        const res = await authClient.signUp.email({ email, password, name });
        if (res.error) throw new Error(res.error.message || "Could not create account");
      } else {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) throw new Error(res.error.message || "Could not sign in");
      }
      await goHome();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function enterDemo(demo: DemoLogin) {
    setBusy(true);
    setError("");
    try {
      await prepareDemoLogins();
      const res = await authClient.signIn.email({ email: demo.email, password: demo.password });
      if (res.error) throw new Error(res.error.message || "Could not sign in");
      await navigate({ to: demo.home });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-sm bg-bg px-4 py-10">
      <Link to="/" className="flex items-center gap-2 text-fg">
        <PitchMark className="size-9" />
        <span className="font-display text-lg font-semibold tracking-wide uppercase">
          Turf Community
        </span>
      </Link>

      <h1 className="mt-8 font-display text-4xl tracking-tight uppercase">Sign in</h1>
      <p className="mt-1 text-sm text-muted">
        {demo
          ? "Five desks: player, gate staff, manager, turf owner, and platform HQ. Tap one, or use your own email."
          : "Owner login. Create an account if you run a ground."}
      </p>

      {demo ? (
      <section className="mt-6 space-y-2">
        {DEMO_LOGINS.map((row) => (
          <button
            key={row.id}
            type="button"
            disabled={busy || !ready}
            onClick={() => void enterDemo(row)}
            className="w-full rounded-lg bg-surface p-4 text-left shadow-[0_0_0_1px_rgba(232,242,235,0.08)] disabled:opacity-50"
          >
            <p className="text-xs font-medium tracking-[0.16em] text-accent uppercase">{row.role}</p>
            <p className="mt-1 font-display text-2xl tracking-tight uppercase">{row.cta}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{row.blurb}</p>
            <p className="mt-2 font-mono text-[11px] text-faint">
              {row.email} · {row.password}
            </p>
          </button>
        ))}
      </section>
      ) : null}

      <div className="my-6 flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-border" />
        or continue
        <span className="h-px flex-1 bg-border" />
      </div>

      {authEnabled ? (
        <div className="space-y-2">
          {GROK_PROVIDERS.map((p) => (
            <Button
              key={p.providerId}
              variant="secondary"
              className="w-full"
              onClick={() => signIn(p.providerId, { callbackURL: "/desk" })}
            >
              Continue with {p.label}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Sign-in is disabled.</p>
      )}

      <div className="my-6 flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-border" />
        email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onEmail} className="space-y-3">
        {mode === "up" ? (
          <Field label="Your name" required hint="The person who runs the ground. Not shown on the public page.">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </Field>
        ) : null}
        <Field label="Email" required hint="This is the login.">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        <Field label="Password" required hint="At least 8 characters.">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "up" ? "Create owner account" : "Sign in with email"}
        </Button>
      </form>

      <button
        type="button"
        className="mt-3 text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
        onClick={() => setMode(mode === "up" ? "in" : "up")}
      >
        {mode === "up" ? "Already have an account? Sign in" : "New turf? Create an owner account"}
      </button>
      <Link to="/learn" className="mt-4 block text-center text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
        What do I need to fill? Owner academy
      </Link>
    </main>
  );
}

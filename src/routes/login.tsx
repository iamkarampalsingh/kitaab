import { createFileRoute, Link, Navigate, useSearch } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GROK_PROVIDERS, authClient, authEnabled, socialLoginEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

type Search = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: Login,
});

function PathRedirect({ path }: { path: string }) {
  useEffect(() => {
    window.location.assign(path);
  }, [path]);
  return (
    <main className="grid min-h-svh place-items-center">
      <p className="text-sm text-ink-soft">Taking you through…</p>
    </main>
  );
}

function Login() {
  const { user, isPending } = useCurrentUserState();
  const { redirect } = useSearch({ from: "/login" });
  const next = redirect && redirect.startsWith("/") ? redirect : "/";

  if (isPending) {
    return (
      <main className="grid min-h-svh place-items-center">
        <div className="h-10 w-40 animate-pulse rounded-lg bg-paper-sunken" />
      </main>
    );
  }
  if (user) {
    if (next !== "/") return <PathRedirect path={next} />;
    return <Navigate to="/" />;
  }

  return (
    <main className="mx-auto grid min-h-svh max-w-md place-items-center px-4 py-10">
      <div className="w-full">
        <Link to="/" className="mb-8 flex items-center gap-2 text-ink">
          <span className="grid size-9 place-items-center rounded-lg bg-pine text-pine-fg">
            <BookOpen className="size-4" />
          </span>
          <span className="font-display text-xl font-semibold">Kitaab</span>
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Open your books.</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Sign in to keep shared ledgers with the people who belong in them.
        </p>
        {authEnabled ? (
          <div className="mt-8 space-y-3">
            {socialLoginEnabled
              ? GROK_PROVIDERS.map((p) => (
                  <Button
                    key={p.providerId}
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => signIn(p.providerId, { callbackURL: next })}
                  >
                    Continue with {p.label}
                  </Button>
                ))
              : null}
            {socialLoginEnabled ? (
              <div className="flex items-center gap-3 py-2">
                <span className="h-px flex-1 bg-line" />
                <span className="text-xs tracking-wide text-ink-faint uppercase">or email</span>
                <span className="h-px flex-1 bg-line" />
              </div>
            ) : null}
            <EmailAuth next={next} />
          </div>
        ) : (
          <p className="mt-6 text-sm text-ink-soft">Sign-in is disabled.</p>
        )}
      </div>
    </main>
  );
}

function EmailAuth({ next }: { next: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const res = await authClient.signUp.email({
          name: name.trim() || email.split("@")[0],
          email: email.trim(),
          password,
          callbackURL: next,
        });
        if (res.error) throw new Error(res.error.message || "Could not create an account.");
      } else {
        const res = await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL: next,
        });
        if (res.error) throw new Error(res.error.message || "Could not sign in.");
      }
      window.location.assign(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {mode === "up" ? (
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete={mode === "up" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Working…" : mode === "up" ? "Create account" : "Sign in with email"}
      </Button>
      <button
        type="button"
        className="w-full text-center text-sm text-ink-soft hover:text-ink"
        onClick={() => setMode(mode === "up" ? "in" : "up")}
      >
        {mode === "up" ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </form>
  );
}

import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Navigate, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/kitaab/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { joinBook } from "@/lib/kitaab/api";

type Search = { code?: string };

export const Route = createFileRoute("/join")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    code: typeof s.code === "string" ? s.code : undefined,
  }),
  component: JoinPage,
});

function JoinPage() {
  const { user, isPending } = useCurrentUserState();
  const { code: preset } = useSearch({ from: "/join" });
  const [code, setCode] = useState(preset ?? "");
  const navigate = useNavigate();

  const mut = useMutation({
    mutationFn: () => joinBook({ data: { code } }),
    onSuccess: (res) => {
      toast.success("You are in.");
      void navigate({ to: "/books/$bookId", params: { bookId: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending) {
    return (
      <div className="min-h-svh">
        <AppHeader />
        <div className="mx-auto max-w-md px-4 py-16">
          <div className="h-10 w-48 animate-pulse rounded-lg bg-paper-sunken" />
        </div>
      </div>
    );
  }
  if (!user) {
    const next = `/join${preset ? `?code=${encodeURIComponent(preset)}` : ""}`;
    return <Navigate to="/login" search={{ redirect: next }} />;
  }

  return (
    <div className="min-h-svh">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-16">
        <p className="text-xs font-medium tracking-[0.2em] text-pine uppercase">Invite</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Join a book</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Enter the six-character code from the person who opened it.
        </p>
        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="code">Invite code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="K7M2PQ"
              className="font-mono tracking-[0.3em] uppercase"
              autoComplete="off"
            />
          </div>
          <Button type="submit" className="w-full" disabled={mut.isPending || code.trim().length < 4}>
            {mut.isPending ? "Joining…" : "Take a seat"}
          </Button>
        </form>
      </main>
    </div>
  );
}

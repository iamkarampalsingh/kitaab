import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookPlus, KeyRound } from "lucide-react";
import { AppHeader } from "@/components/kitaab/app-header";
import { CreateBookDialog } from "@/components/kitaab/create-book-dialog";
import { BookCover } from "@/components/book-cover";
import { AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GROK_PROVIDERS, authEnabled, socialLoginEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getDashboard } from "@/lib/kitaab/api";
import { formatMoney, signedMoney } from "@/lib/kitaab/money";
import type { BookSummary } from "@/lib/kitaab/types";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <PageSkeleton />;
  if (!user) return <Landing />;
  return <Dashboard />;
}

function PageSkeleton() {
  return (
    <div className="min-h-svh">
      <AppHeader />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="h-10 w-48" />
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-svh">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-12 md:py-20">
        <p className="text-xs font-medium tracking-[0.22em] text-pine uppercase">
          Shared money notebooks
        </p>
        <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.1] font-semibold tracking-tight md:text-6xl">
          A book for every life you share.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft md:text-lg">
          Name it anything — a flat, a studio, a January trip, a cricket team.
          Kitaab keeps the ledger, the chat, and the reckoning in one bound volume.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {socialLoginEnabled
            ? GROK_PROVIDERS.map((p) => (
                <Button
                  key={p.providerId}
                  type="button"
                  onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                >
                  Continue with {p.label}
                </Button>
              ))
            : null}
          {authEnabled ? (
            <Button variant={socialLoginEnabled ? "outline" : "default"} asChild>
              <Link to="/login">{socialLoginEnabled ? "Email instead" : "Open your books"}</Link>
            </Button>
          ) : null}
        </div>
        <p className="mt-16 text-xs font-medium tracking-[0.22em] text-pine uppercase">
          How money moves
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Feature
            title="Tab"
            body="Pay as you go. Running balances, settle when you like — a work tab, a group dinner, anything in between."
          />
          <Feature
            title="Pot"
            body="Everyone chips in up front. Expenses draw from the pot, and the book closes with a reckoning."
          />
          <Feature
            title="Household float"
            body="No constant settling. Who covered rent, what the month cost — a picture, not a demand."
          />
        </div>
      </main>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <article className="paper-card rounded-2xl p-5">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
    </article>
  );
}

function Dashboard() {
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  if (q.isError) {
    return (
      <div className="min-h-svh">
        <AppHeader />
        <p className="p-8 text-sm text-danger">{(q.error as Error).message}</p>
      </div>
    );
  }
  if (!q.data) {
    return <PageSkeleton />;
  }
  const { books, pulse, me } = q.data;
  return (
    <div className="min-h-svh pb-16">
      <AppHeader
        right={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/join">
                <KeyRound className="size-4" />
                <span className="hidden sm:inline">Join</span>
              </Link>
            </Button>
            <CreateBookDialog>
              <Button size="sm">
                <BookPlus className="size-4" />
                <span className="hidden sm:inline">New book</span>
              </Button>
            </CreateBookDialog>
          </div>
        }
      />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-sm text-ink-soft">Good to see you, {me.name.split(" ")[0]}.</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Your shelf</h1>
        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <PulseCard label="Covered this month" value={formatMoney(pulse.coveredThisMonth)} />
          <PulseCard
            label="Your net"
            value={signedMoney(pulse.netBalance)}
            hint={pulse.netBalance >= 0 ? "Owed to you" : "You owe"}
          />
          <PulseCard label="Waiting approval" value={String(pulse.pendingApprovals)} />
          <PulseCard label="Reminders ahead" value={String(pulse.upcomingReminders)} />
        </section>
        {books.length === 0 ? (
          <EmptyShelf />
        ) : (
          <ul className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {books.map((b) => (
              <li key={b.id}>
                <BookCard book={b} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function PulseCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="paper-card rounded-2xl p-4">
      <p className="text-[11px] tracking-wide text-ink-faint uppercase">{label}</p>
      <p className="mt-2 font-display text-xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-ink-soft">{hint}</p> : null}
    </div>
  );
}

function BookCard({ book }: { book: BookSummary }) {
  const budgetLeft =
    book.budgetPaise != null ? book.budgetPaise - book.spentPaise : null;
  const weather =
    budgetLeft == null
      ? null
      : budgetLeft < 0
        ? "Over budget"
        : budgetLeft / (book.budgetPaise || 1) < 0.25
          ? "Running low"
          : "On track";
  return (
    <Link
      to="/books/$bookId"
      params={{ bookId: book.id }}
      className="group block"
    >
      <BookCover title={book.title} cashflow={book.cashflow} coverTone={book.coverTone} />
      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{book.title}</p>
          <p className="text-[11px] text-ink-soft tabular-nums">
            {formatMoney(book.spentPaise, book.currency)} spent
            {weather ? ` · ${weather}` : ""}
          </p>
        </div>
        <AvatarStack people={book.members} />
      </div>
    </Link>
  );
}

function EmptyShelf() {
  return (
    <div className="paper-card mt-10 rounded-3xl px-6 py-14 text-center">
      <h2 className="font-display text-2xl font-semibold">The shelf is empty.</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
        Open a book under any name — then invite the people who belong in it.
        Choose how money moves: a tab, a pot, or a household float.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <CreateBookDialog>
          <Button>
            Open a book <ArrowRight className="size-4" />
          </Button>
        </CreateBookDialog>
        <Button variant="outline" asChild>
          <Link to="/join">I have an invite code</Link>
        </Button>
      </div>
    </div>
  );
}

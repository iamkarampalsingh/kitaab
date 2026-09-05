import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { format, formatDistanceToNow, parseISO } from "date-fns";

function asDate(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") return parseISO(value);
  return new Date();
}
import {
  Bell,
  Check,
  Copy,
  DoorOpen,
  Image as ImageIcon,
  Lock,
  MessageCircle,
  Plus,
  Scale,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BookCover } from "@/components/book-cover";
import { AppHeader } from "@/components/kitaab/app-header";
import { ExpenseSheet } from "@/components/kitaab/expense-sheet";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  addPotEntry,
  addReminder,
  getBook,
  getReceipt,
  kickMember,
  leaveBook,
  listMessages,
  rotateInvite,
  sendMessage,
  setBookStatus,
  setExpenseApproval,
  setMemberRole,
  settleUp,
  toggleReminder,
  votePoll,
} from "@/lib/kitaab/api";
import { CASHFLOW_COPY, TABS, type BookTab } from "@/lib/kitaab/constants";
import { formatMoney, rupeesToPaise, signedMoney } from "@/lib/kitaab/money";
import type { BookDetail, ChatMessage, Expense, Member } from "@/lib/kitaab/types";
import { cn } from "@/lib/utils";

type Search = { tab?: BookTab };

export const Route = createFileRoute("/books/$bookId")({
  validateSearch: (s: Record<string, unknown>): Search => {
    if (TABS.includes(s.tab as BookTab)) return { tab: s.tab as BookTab };
    return {};
  },
  component: BookPage,
});

function BookPage() {
  const { bookId } = Route.useParams();
  const { tab = "ledger" } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["book", bookId],
    queryFn: () => getBook({ data: { bookId } }),
    enabled: !!user,
    refetchInterval: 12_000,
  });

  if (isPending) {
    return (
      <div className="min-h-svh">
        <AppHeader />
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="h-24 animate-pulse rounded-2xl bg-paper-sunken" />
        </div>
      </div>
    );
  }
  if (!user) {
    return (
      <Navigate
        to="/login"
        search={{ redirect: `/books/${bookId}` }}
      />
    );
  }
  if (q.isError) {
    return (
      <div className="min-h-svh">
        <AppHeader />
        <p className="p-8 text-sm text-danger">{(q.error as Error).message}</p>
        <p className="px-8">
          <Link to="/" className="text-pine underline">
            Back to shelf
          </Link>
        </p>
      </div>
    );
  }
  if (!q.data) {
    return (
      <div className="min-h-svh">
        <AppHeader />
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="h-24 animate-pulse rounded-2xl bg-paper-sunken" />
        </div>
      </div>
    );
  }

  const detail = q.data;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["book", bookId] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    void qc.invalidateQueries({ queryKey: ["chat", bookId] });
  };

  return (
    <div className="min-h-svh pb-24">
      <AppHeader />
      <BookHero detail={detail} />
      <TabBar bookId={bookId} tab={tab} />
      <div className="mx-auto max-w-6xl px-4 py-6">
        {tab === "ledger" ? <Ledger detail={detail} onChange={refresh} /> : null}
        {tab === "chat" ? <ChatPane detail={detail} /> : null}
        {tab === "people" ? <PeoplePane detail={detail} onChange={refresh} /> : null}
        {tab === "reminders" ? <RemindersPane detail={detail} onChange={refresh} /> : null}
        {tab === "reckon" ? <ReckonPane detail={detail} onChange={refresh} /> : null}
      </div>
      {detail.me.role !== "viewer" && detail.book.status === "open" ? (
        <>
          <button
            type="button"
            onClick={() => setExpenseOpen(true)}
            className="fixed right-4 bottom-5 z-40 flex h-14 items-center gap-2 rounded-full bg-pine px-5 text-sm font-medium text-pine-fg shadow-[0_10px_30px_-12px_rgb(47_93_80/0.9)] md:bottom-8"
          >
            <Plus className="size-4" />
            Add expense
          </button>
          <ExpenseSheet
            open={expenseOpen}
            onOpenChange={setExpenseOpen}
            detail={detail}
            onSaved={refresh}
          />
        </>
      ) : null}
    </div>
  );
}

function BookHero({ detail }: { detail: BookDetail }) {
  const { book } = detail;
  const left = book.budgetPaise != null ? book.budgetPaise - book.spentPaise : null;
  const ratio =
    book.budgetPaise && book.budgetPaise > 0
      ? Math.min(1, book.spentPaise / book.budgetPaise)
      : 0;
  return (
    <section className="border-b border-line/80">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[140px_1fr] md:items-center">
        <BookCover
          title={book.title}
          cashflow={book.cashflow}
          coverTone={book.coverTone}
          compact
          className="mx-auto w-28 md:w-full"
        />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="pine">{CASHFLOW_COPY[book.cashflow].label}</Badge>
            {book.status !== "open" ? <Badge variant="warn">{book.status}</Badge> : null}
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{book.title}</h1>
          {book.description ? (
            <p className="mt-1 text-sm text-ink-soft">{book.description}</p>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Spent" value={formatMoney(book.spentPaise, book.currency)} />
            <Stat
              label="Your net"
              value={signedMoney(book.myNet, book.currency)}
            />
            <Stat
              label="Budget left"
              value={left == null ? "—" : formatMoney(left, book.currency)}
            />
          </div>
          {book.budgetPaise != null ? (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-sunken">
              <div
                className={cn("h-full rounded-full", ratio > 1 ? "bg-danger" : "bg-pine")}
                style={{ width: `${Math.min(100, ratio * 100)}%` }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] tracking-wide text-ink-faint uppercase">{label}</p>
      <p className="font-display text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function TabBar({ bookId, tab }: { bookId: string; tab: BookTab }) {
  const items: { id: BookTab; label: string; icon: typeof Wallet }[] = [
    { id: "ledger", label: "Ledger", icon: Wallet },
    { id: "chat", label: "Chat", icon: MessageCircle },
    { id: "people", label: "People", icon: Users },
    { id: "reminders", label: "Reminders", icon: Bell },
    { id: "reckon", label: "Reckon", icon: Scale },
  ];
  return (
    <nav className="sticky top-14 z-20 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 py-2">
        {items.map((it) => {
          const Icon = it.icon;
          const on = tab === it.id;
          return (
            <Link
              key={it.id}
              to="/books/$bookId"
              params={{ bookId }}
              search={{ tab: it.id }}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm",
                on ? "bg-pine text-pine-fg" : "text-ink-soft hover:bg-paper-sunken",
              )}
            >
              <Icon className="size-4" />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function nameOf(detail: BookDetail, userId: string) {
  return detail.members.find((m) => m.userId === userId)?.name ?? "Member";
}

function Ledger({ detail, onChange }: { detail: BookDetail; onChange: () => void }) {
  const grouped = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of detail.expenses) {
      const key = e.spentAt;
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [detail.expenses]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div>
        {detail.book.cashflow === "pot" && detail.pot ? (
          <PotCard detail={detail} onChange={onChange} />
        ) : null}
        {grouped.length === 0 ? (
          <div className="paper-card rounded-2xl px-5 py-12 text-center">
            <p className="font-display text-xl">No entries yet.</p>
            <p className="mt-1 text-sm text-ink-soft">
              Log the first expense — dinner, fuel, a packet of chai.
            </p>
          </div>
        ) : (
          <ol className="space-y-8">
            {grouped.map(([day, items]) => (
              <li key={day}>
                <p className="mb-3 text-[11px] font-medium tracking-[0.16em] text-ink-faint uppercase">
                  {format(asDate(day), "EEEE, d MMM")}
                </p>
                <ul className="space-y-2">
                  {items.map((e) => (
                    <ExpenseRow key={e.id} expense={e} detail={detail} onChange={onChange} />
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>
      <aside className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Balances</h2>
        {detail.book.cashflow === "household" ? (
          <p className="text-xs text-ink-soft">
            Household float — this is a picture, not a demand.
          </p>
        ) : null}
        {detail.balances
          .filter((b) => detail.members.some((m) => m.userId === b.userId && m.status === "active"))
          .map((b) => (
            <div key={b.userId} className="paper-card flex items-center justify-between rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Avatar
                  id={b.userId}
                  name={b.name}
                  image={detail.members.find((m) => m.userId === b.userId)?.image}
                  size="sm"
                />
                <span className="text-sm">{b.name.split(" ")[0]}</span>
              </div>
              <span
                className={cn(
                  "text-sm tabular-nums",
                  b.net > 0 ? "text-pine" : b.net < 0 ? "text-danger" : "text-ink-soft",
                )}
              >
                {signedMoney(b.net, detail.book.currency)}
              </span>
            </div>
          ))}
      </aside>
    </div>
  );
}

function PotCard({ detail, onChange }: { detail: BookDetail; onChange: () => void }) {
  const [amt, setAmt] = useState("");
  const mut = useMutation({
    mutationFn: () =>
      addPotEntry({
        data: {
          bookId: detail.book.id,
          amountPaise: rupeesToPaise(Number(amt)),
          note: "",
        },
      }),
    onSuccess: () => {
      setAmt("");
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const pot = detail.pot!;
  return (
    <div className="paper-card mb-6 rounded-2xl p-4">
      <p className="text-[11px] tracking-wide text-ink-faint uppercase">The pot</p>
      <div className="mt-2 flex flex-wrap gap-6">
        <Stat label="In" value={formatMoney(pot.totalIn, detail.book.currency)} />
        <Stat label="Spent" value={formatMoney(pot.spent, detail.book.currency)} />
        <Stat label="Left" value={formatMoney(pot.remaining, detail.book.currency)} />
      </div>
      {detail.book.status === "open" && detail.me.role !== "viewer" ? (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
        >
          <Input
            inputMode="decimal"
            placeholder="Chip in"
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
          />
          <Button type="submit" disabled={mut.isPending || !amt}>
            Add
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function ExpenseRow({
  expense,
  detail,
  onChange,
}: {
  expense: Expense;
  detail: BookDetail;
  onChange: () => void;
}) {
  const [showReceipt, setShowReceipt] = useState(false);
  const canApprove =
    (detail.me.role === "owner" || detail.me.role === "approver") &&
    expense.approvalStatus === "pending";

  return (
    <li className="paper-card rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{expense.title}</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {expense.category}
            {" · "}
            {expense.isTreat
              ? "Treat"
              : expense.isPersonal
                ? "Personal"
                : `Split · ${nameOf(detail, expense.paidBy)} paid`}
          </p>
        </div>
        <p className="font-display text-lg font-semibold tabular-nums">
          {formatMoney(expense.amountPaise, detail.book.currency)}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {expense.approvalStatus !== "none" ? (
          <Badge variant={expense.approvalStatus === "pending" ? "warn" : "pine"}>
            {expense.approvalStatus}
          </Badge>
        ) : null}
        {expense.hasReceipt ? (
          <Button size="sm" variant="ghost" onClick={() => setShowReceipt(true)}>
            <ImageIcon className="size-3.5" />
            Receipt
          </Button>
        ) : null}
        {canApprove ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setExpenseApproval({ data: { expenseId: expense.id, status: "approved" } })
                .then(onChange)
                .catch((e: Error) => toast.error(e.message))
            }
          >
            <Check className="size-3.5" />
            Approve
          </Button>
        ) : null}
        {expense.approvalStatus === "approved" &&
        (detail.me.role === "owner" || detail.me.role === "approver") ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setExpenseApproval({ data: { expenseId: expense.id, status: "reimbursed" } })
                .then(onChange)
                .catch((e: Error) => toast.error(e.message))
            }
          >
            Mark reimbursed
          </Button>
        ) : null}
      </div>
      {showReceipt ? (
        <ReceiptViewer expenseId={expense.id} onClose={() => setShowReceipt(false)} />
      ) : null}
    </li>
  );
}

function ReceiptViewer({ expenseId, onClose }: { expenseId: string; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["receipt", expenseId],
    queryFn: () => getReceipt({ data: { expenseId } }),
  });
  if (!q.data) {
    return <p className="mt-3 text-xs text-ink-soft">{q.isError ? "No receipt." : "Loading receipt…"}</p>;
  }
  return (
    <div className="mt-3">
      <img
        src={`data:${q.data.mime};base64,${q.data.dataB64}`}
        alt="Receipt"
        className="max-h-80 w-full rounded-xl object-contain outline outline-1 -outline-offset-1 outline-ink/10"
      />
      <Button size="sm" variant="ghost" className="mt-2" onClick={onClose}>
        Hide
      </Button>
    </div>
  );
}

function ChatPane({ detail }: { detail: BookDetail }) {
  const [body, setBody] = useState("");
  const [pollMode, setPollMode] = useState(false);
  const [estimate, setEstimate] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["chat", detail.book.id],
    queryFn: () => listMessages({ data: { bookId: detail.book.id } }),
    refetchInterval: 4000,
  });

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [q.data?.length]);

  const send = useMutation({
    mutationFn: async () => {
      if (pollMode) {
        const payload = JSON.stringify({
          question: body.trim(),
          estimatePaise: estimate ? rupeesToPaise(Number(estimate)) : null,
          yes: [] as string[],
          no: [] as string[],
        });
        return sendMessage({
          data: { bookId: detail.book.id, body: payload, kind: "poll" },
        });
      }
      return sendMessage({ data: { bookId: detail.book.id, body } });
    },
    onSuccess: () => {
      setBody("");
      setEstimate("");
      setPollMode(false);
      void qc.invalidateQueries({ queryKey: ["chat", detail.book.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto flex min-h-[60svh] max-w-2xl flex-col">
      <div className="flex-1 space-y-3">
        {(q.data ?? []).map((m) => (
          <ChatBubble
            key={m.id}
            message={m}
            detail={detail}
            mine={m.userId === detail.me.userId}
            onVote={() => void qc.invalidateQueries({ queryKey: ["chat", detail.book.id] })}
          />
        ))}
        <div ref={bottom} />
      </div>
      {detail.me.role !== "viewer" ? (
        <form
          className="sticky bottom-4 mt-4 space-y-2 rounded-2xl bg-paper-raised p-3 paper-card"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-ink-soft">
              {pollMode ? "Ask who’s in" : "Write to the book"}
            </p>
            <button
              type="button"
              className="text-[11px] text-pine"
              onClick={() => setPollMode((v) => !v)}
            >
              {pollMode ? "Plain message" : "Turn into a poll"}
            </button>
          </div>
          <Textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={pollMode ? "Sunrise balloon? Who’s in?" : "A line for the others…"}
          />
          {pollMode ? (
            <Input
              inputMode="decimal"
              placeholder="Estimated cost (optional)"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
            />
          ) : null}
          <Button type="submit" className="w-full" disabled={send.isPending || !body.trim()}>
            {send.isPending ? "Sending…" : pollMode ? "Post poll" : "Send"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function ChatBubble({
  message,
  detail,
  mine,
  onVote,
}: {
  message: ChatMessage;
  detail: BookDetail;
  mine: boolean;
  onVote: () => void;
}) {
  if (message.kind === "system" || message.kind === "expense") {
    return (
      <p className="px-2 text-center text-[11px] text-ink-faint">{message.body}</p>
    );
  }
  if (message.kind === "poll") {
    let parsed: { question: string; estimatePaise: number | null; yes: string[]; no: string[] };
    try {
      parsed = JSON.parse(message.body) as typeof parsed;
    } catch {
      return null;
    }
    return (
      <div className="paper-card rounded-2xl p-4">
        <p className="text-sm font-medium">{parsed.question}</p>
        {parsed.estimatePaise ? (
          <p className="text-xs text-ink-soft">
            About {formatMoney(parsed.estimatePaise, detail.book.currency)}
          </p>
        ) : null}
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              votePoll({ data: { messageId: message.id, yes: true } })
                .then(onVote)
                .catch((e: Error) => toast.error(e.message))
            }
          >
            In · {parsed.yes.length}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              votePoll({ data: { messageId: message.id, yes: false } })
                .then(onVote)
                .catch((e: Error) => toast.error(e.message))
            }
          >
            Out · {parsed.no.length}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex gap-2", mine && "flex-row-reverse")}>
      <Avatar
        id={message.userId ?? "sys"}
        name={message.name}
        image={message.image}
        size="sm"
      />
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
          mine ? "bg-pine text-pine-fg rounded-tr-sm" : "bg-paper-sunken rounded-tl-sm",
        )}
      >
        {!mine ? <p className="mb-0.5 text-[10px] opacity-70">{message.name}</p> : null}
        <p>{message.body}</p>
        <p className={cn("mt-1 text-[10px]", mine ? "text-pine-fg/70" : "text-ink-faint")}>
          {formatDistanceToNow(asDate(message.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

function PeoplePane({ detail, onChange }: { detail: BookDetail; onChange: () => void }) {
  const navigate = useNavigate();
  const isOwner = detail.me.role === "owner";
  const active = detail.members.filter((m) => m.status === "active");
  const frozen = detail.members.filter((m) => m.status !== "active");

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(detail.book.inviteCode);
      toast.success("Invite code copied.");
    } catch {
      toast.error("Could not copy.");
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="paper-card rounded-2xl p-5">
        <p className="text-[11px] tracking-wide text-ink-faint uppercase">Invite code</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="font-mono text-2xl tracking-[0.28em]">{detail.book.inviteCode}</p>
          <Button variant="outline" size="icon" onClick={() => void copyCode()} aria-label="Copy invite code">
            <Copy className="size-4" />
          </Button>
        </div>
        {isOwner ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() =>
              rotateInvite({ data: { bookId: detail.book.id } })
                .then(onChange)
                .catch((e: Error) => toast.error(e.message))
            }
          >
            Rotate code
          </Button>
        ) : null}
      </div>
      <ul className="space-y-2">
        {active.map((m) => (
          <MemberRow key={m.id} member={m} detail={detail} onChange={onChange} />
        ))}
      </ul>
      {frozen.length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] tracking-wide text-ink-faint uppercase">
            Closed seats — history kept
          </p>
          <ul className="space-y-2 opacity-70">
            {frozen.map((m) => (
              <li key={m.id} className="paper-card flex items-center justify-between rounded-xl px-3 py-2">
                <span className="text-sm">{m.name}</span>
                <Badge>{m.status}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {detail.me.role !== "owner" ? (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            if (!confirm("Leave this book? Past expenses stay in the ledger.")) return;
            leaveBook({ data: { bookId: detail.book.id } })
              .then(() => {
                toast.success("You left the book.");
                void navigate({ to: "/" });
              })
              .catch((e: Error) => toast.error(e.message));
          }}
        >
          <DoorOpen className="size-4" />
          Leave book
        </Button>
      ) : null}
    </div>
  );
}

function MemberRow({
  member,
  detail,
  onChange,
}: {
  member: Member;
  detail: BookDetail;
  onChange: () => void;
}) {
  const isOwner = detail.me.role === "owner";
  const isMe = member.userId === detail.me.userId;
  return (
    <li className="paper-card flex items-center justify-between gap-3 rounded-xl px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <Avatar id={member.userId} name={member.name} image={member.image} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {member.name}
            {isMe ? " (you)" : ""}
          </p>
          <p className="text-[11px] text-ink-soft capitalize">{member.role}</p>
        </div>
      </div>
      {isOwner && !isMe ? (
        <div className="flex items-center gap-1">
          <select
            value={member.role}
            className="h-9 rounded-md border border-line bg-paper-raised px-2 text-xs"
            onChange={(e) =>
              setMemberRole({
                data: {
                  bookId: detail.book.id,
                  userId: member.userId,
                  role: e.target.value as Member["role"],
                },
              })
                .then(onChange)
                .catch((err: Error) => toast.error(err.message))
            }
          >
            <option value="approver">Approver</option>
            <option value="contributor">Contributor</option>
            <option value="viewer">Viewer</option>
          </select>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (!confirm(`Drop ${member.name}? History stays.`)) return;
              kickMember({ data: { bookId: detail.book.id, userId: member.userId } })
                .then(onChange)
                .catch((e: Error) => toast.error(e.message));
            }}
          >
            Drop
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function RemindersPane({ detail, onChange }: { detail: BookDetail; onChange: () => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [assigned, setAssigned] = useState<string>("");
  const mut = useMutation({
    mutationFn: () =>
      addReminder({
        data: {
          bookId: detail.book.id,
          title,
          dueAt: new Date(due + "T09:00:00").toISOString(),
          assignedTo: assigned || null,
        },
      }),
    onSuccess: () => {
      setTitle("");
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mx-auto max-w-xl space-y-6">
      {detail.me.role !== "viewer" && detail.book.status === "open" ? (
        <form
          className="paper-card space-y-3 rounded-2xl p-4"
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
        >
          <p className="font-display text-lg font-semibold">Set a reminder</p>
          <Input
            placeholder="Rent. Rotate who pays."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="due">Due</Label>
              <Input id="due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="who">For</Label>
              <select
                id="who"
                value={assigned}
                onChange={(e) => setAssigned(e.target.value)}
                className="h-11 w-full rounded-lg border border-line bg-paper-raised px-3 text-sm"
              >
                <option value="">Everyone</option>
                {detail.members
                  .filter((m) => m.status === "active")
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <Button type="submit" disabled={mut.isPending || !title.trim()}>
            {mut.isPending ? "Saving…" : "Add reminder"}
          </Button>
        </form>
      ) : null}
      <ul className="space-y-2">
        {detail.reminders.length === 0 ? (
          <p className="text-sm text-ink-soft">No reminders in this book.</p>
        ) : (
          detail.reminders.map((r) => (
            <li key={r.id} className="paper-card flex items-center justify-between gap-3 rounded-xl px-3 py-3">
              <div>
                <p className={cn("text-sm font-medium", r.done && "text-ink-faint line-through")}>
                  {r.title}
                </p>
                <p className="text-[11px] text-ink-soft">
                  {format(asDate(r.dueAt), "d MMM")}
                  {r.assignedTo ? ` · ${nameOf(detail, r.assignedTo)}` : " · everyone"}
                </p>
              </div>
              <Switch
                checked={r.done}
                onCheckedChange={(done) =>
                  toggleReminder({ data: { reminderId: r.id, done } })
                    .then(onChange)
                    .catch((e: Error) => toast.error(e.message))
                }
              />
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function ReckonPane({ detail, onChange }: { detail: BookDetail; onChange: () => void }) {
  const isOwner = detail.me.role === "owner";
  const biggest = detail.expenses.filter((e) => !e.isPersonal)[0];
  const days = new Set(detail.expenses.map((e) => e.spentAt)).size;
  const treats = detail.expenses.filter((e) => e.isTreat).length;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="paper-card rounded-3xl p-6">
        <p className="text-xs tracking-[0.2em] text-pine uppercase">The reckoning</p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          {detail.book.title}
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          {days} day{days === 1 ? "" : "s"} · {formatMoney(detail.book.spentPaise, detail.book.currency)} spent
          {treats ? ` · ${treats} treat${treats === 1 ? "" : "s"}` : ""}
        </p>
        {biggest ? (
          <p className="mt-4 text-sm">
            Largest entry: {biggest.title} ·{" "}
            {formatMoney(biggest.amountPaise, detail.book.currency)}
          </p>
        ) : (
          <p className="mt-4 text-sm text-ink-soft">Nothing to settle yet.</p>
        )}
      </div>
      <div>
        <h3 className="font-display text-lg font-semibold">Fewest payments</h3>
        {detail.book.cashflow === "household" ? (
          <p className="mt-1 text-xs text-ink-soft">
            Household books prefer insight over IOUs. Settle only if you want to.
          </p>
        ) : null}
        {detail.transfers.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">Everyone is square.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {detail.transfers.map((t) => (
              <li
                key={`${t.from}-${t.to}`}
                className="paper-card flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-3"
              >
                <p className="text-sm">
                  <span className="font-medium">{nameOf(detail, t.from)}</span>
                  {" pays "}
                  <span className="font-medium">{nameOf(detail, t.to)}</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-sm font-medium">
                    {formatMoney(t.amount, detail.book.currency)}
                  </span>
                  {detail.book.status !== "archived" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        settleUp({
                          data: {
                            bookId: detail.book.id,
                            fromUser: t.from,
                            toUser: t.to,
                            amountPaise: t.amount,
                            method: "other",
                          },
                        })
                          .then(() => {
                            toast.success("Marked settled.");
                            onChange();
                          })
                          .catch((e: Error) => toast.error(e.message))
                      }
                    >
                      Mark paid
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {isOwner ? (
        <div className="flex flex-wrap gap-2">
          {detail.book.status === "open" ? (
            <Button
              variant="outline"
              onClick={() =>
                setBookStatus({ data: { bookId: detail.book.id, status: "locked" } })
                  .then(onChange)
                  .catch((e: Error) => toast.error(e.message))
              }
            >
              <Lock className="size-4" />
              Close for reckoning
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() =>
                setBookStatus({ data: { bookId: detail.book.id, status: "open" } })
                  .then(onChange)
                  .catch((e: Error) => toast.error(e.message))
              }
            >
              Reopen book
            </Button>
          )}
          {detail.book.status !== "archived" ? (
            <Button
              variant="ghost"
              onClick={() => {
                if (!confirm("Archive this book? It becomes a memory.")) return;
                setBookStatus({ data: { bookId: detail.book.id, status: "archived" } })
                  .then(onChange)
                  .catch((e: Error) => toast.error(e.message));
              }}
            >
              Archive as memory
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

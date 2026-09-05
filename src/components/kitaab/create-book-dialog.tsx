import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Coins, Home, Wallet, type LucideIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { BookCover } from "@/components/book-cover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createBook } from "@/lib/kitaab/api";
import {
  CASHFLOW_COPY,
  CASHFLOWS,
  COVER_TONES,
  COVER_LABEL,
  CURRENCIES,
  NAME_IDEAS,
  type Cashflow,
  type CoverTone,
} from "@/lib/kitaab/constants";
import { rupeesToPaise } from "@/lib/kitaab/money";
import { cn } from "@/lib/utils";

const CASHFLOW_ICON: Record<Cashflow, LucideIcon> = {
  tab: Wallet,
  pot: Coins,
  household: Home,
};

export function CreateBookDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [cashflow, setCashflow] = useState<Cashflow>("tab");
  const [coverTone, setCoverTone] = useState<CoverTone>("steel");
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [coverTouched, setCoverTouched] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () =>
      createBook({
        data: {
          title,
          cashflow,
          coverTone,
          currency,
          budgetPaise: budget.trim() ? rupeesToPaise(Number(budget)) : null,
          description,
        },
      }),
    onSuccess: (res) => {
      toast.success("Book opened.");
      setOpen(false);
      setTitle("");
      setDescription("");
      setBudget("");
      setCoverTouched(false);
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void navigate({ to: "/books/$bookId", params: { bookId: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function pickCashflow(c: Cashflow) {
    setCashflow(c);
    if (!coverTouched) setCoverTone(CASHFLOW_COPY[c].defaultCover);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Open a book</DialogTitle>
          <DialogDescription>
            Give it any name. Then choose how money moves inside it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="book-title">Name</Label>
          <Input
            id="book-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Goa 2026, Flat 4B, Studio…"
            autoFocus
            className="h-12 font-display text-lg"
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {NAME_IDEAS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTitle(n)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  title === n
                    ? "border-pine bg-pine/8 text-ink"
                    : "border-line text-ink-soft hover:border-pine/40 hover:text-ink",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>How money moves</Label>
          <div className="grid gap-2">
            {CASHFLOWS.map((c) => {
              const Icon = CASHFLOW_ICON[c];
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => pickCashflow(c)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left",
                    cashflow === c ? "border-pine bg-pine/8" : "border-line hover:bg-paper-sunken",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg",
                      cashflow === c ? "bg-pine text-pine-fg" : "bg-paper-sunken text-ink-soft",
                    )}
                  >
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span>
                    <p className="text-sm font-medium">{CASHFLOW_COPY[c].label}</p>
                    <p className="text-[11px] text-ink-soft">{CASHFLOW_COPY[c].blurb}</p>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-11 w-full rounded-lg border border-line bg-paper-raised px-3 text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget">Budget (optional)</Label>
            <Input
              id="budget"
              inputMode="decimal"
              placeholder="50000"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desc">Note</Label>
          <Textarea
            id="desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A quiet line about this book."
          />
        </div>
        <div>
          <Label>Cover</Label>
          <div className="mt-2 grid grid-cols-6 gap-2">
            {COVER_TONES.map((t) => (
              <button
                key={t}
                type="button"
                aria-label={COVER_LABEL[t]}
                onClick={() => {
                  setCoverTone(t);
                  setCoverTouched(true);
                }}
                className={cn(
                  "overflow-hidden rounded-lg ring-offset-2 ring-offset-paper",
                  coverTone === t ? "ring-2 ring-pine" : "ring-1 ring-line",
                )}
              >
                <BookCover title="" cashflow={cashflow} coverTone={t} compact className="min-h-16" />
              </button>
            ))}
          </div>
        </div>
        <Button
          className="w-full"
          disabled={mut.isPending || title.trim().length < 2}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? "Opening…" : `Open ${title.trim() || "book"}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

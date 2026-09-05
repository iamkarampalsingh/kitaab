import { useMutation } from "@tanstack/react-query";
import { ImagePlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { addExpense } from "@/lib/kitaab/api";
import { CATEGORIES } from "@/lib/kitaab/constants";
import { compressReceipt } from "@/lib/kitaab/image";
import { formatMoney, rupeesToPaise } from "@/lib/kitaab/money";
import type { BookDetail } from "@/lib/kitaab/types";
import { cn } from "@/lib/utils";

export function ExpenseSheet({
  open,
  onOpenChange,
  detail,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detail: BookDetail;
  onSaved: () => void;
}) {
  const active = detail.members.filter((m) => m.status === "active");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [note, setNote] = useState("");
  const [spentAt, setSpentAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [paidBy, setPaidBy] = useState(detail.me.userId);
  const [included, setIncluded] = useState<string[]>(active.map((m) => m.userId));
  const [isTreat, setIsTreat] = useState(false);
  const [isPersonal, setIsPersonal] = useState(false);
  const [receipt, setReceipt] = useState<{ mime: string; dataB64: string } | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);

  const paise = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n > 0 ? rupeesToPaise(n) : 0;
  }, [amount]);

  function reset() {
    setTitle("");
    setAmount("");
    setNote("");
    setIsTreat(false);
    setIsPersonal(false);
    setReceipt(null);
    setReceiptName(null);
    setIncluded(active.map((m) => m.userId));
    setPaidBy(detail.me.userId);
    setSpentAt(new Date().toISOString().slice(0, 10));
  }

  const mut = useMutation({
    mutationFn: () =>
      addExpense({
        data: {
          bookId: detail.book.id,
          title,
          amountPaise: paise,
          category,
          note,
          spentAt,
          paidBy,
          includedUserIds: isPersonal ? [paidBy] : included,
          isTreat,
          isPersonal,
          receipt,
        },
      }),
    onSuccess: () => {
      toast.success(isTreat ? "Treat logged." : "Expense added.");
      reset();
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const compressed = await compressReceipt(file);
      setReceipt(compressed);
      setReceiptName(file.name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not attach the receipt.");
    }
  }

  function toggle(id: string) {
    setIncluded((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add an expense</DialogTitle>
          <DialogDescription>
            Tap who was there. Treats log the evening without creating a debt.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="amt">Amount</Label>
            <Input
              id="amt"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1.5 h-14 font-display text-2xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="what">What for</Label>
            <Input
              id="what"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dinner at Olive"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat">Category</Label>
              <select
                id="cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-11 w-full rounded-lg border border-line bg-paper-raised px-3 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="when">Date</Label>
              <Input id="when" type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Who paid</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {active.map((m) => (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => setPaidBy(m.userId)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm",
                    paidBy === m.userId ? "border-pine bg-pine/10" : "border-line",
                  )}
                >
                  <Avatar id={m.userId} name={m.name} image={m.image} size="sm" />
                  {m.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-paper-sunken/70 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">This one’s on me</p>
              <p className="text-[11px] text-ink-soft">Treat — logged, no split.</p>
            </div>
            <Switch
              checked={isTreat}
              onCheckedChange={(v) => {
                setIsTreat(v);
                if (v) setIsPersonal(false);
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-paper-sunken/70 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Personal</p>
              <p className="text-[11px] text-ink-soft">Does not touch the group budget.</p>
            </div>
            <Switch
              checked={isPersonal}
              onCheckedChange={(v) => {
                setIsPersonal(v);
                if (v) setIsTreat(false);
              }}
            />
          </div>
          {!isPersonal ? (
            <div>
              <Label>Who was there</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {active.map((m) => {
                  const on = included.includes(m.userId);
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => toggle(m.userId)}
                      className={cn(
                        "flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-opacity",
                        on ? "border-pine bg-pine/10" : "border-line opacity-45",
                      )}
                    >
                      <Avatar id={m.userId} name={m.name} image={m.image} size="sm" />
                      {m.name.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="note">Note</Label>
            <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div>
            <Label>Receipt</Label>
            {receipt ? (
              <div className="mt-2 flex items-center gap-3">
                <img
                  src={`data:${receipt.mime};base64,${receipt.dataB64}`}
                  alt="Receipt preview"
                  className="h-16 w-16 rounded-lg object-cover outline outline-1 -outline-offset-1 outline-ink/10"
                />
                <p className="min-w-0 flex-1 truncate text-sm text-ink-soft">{receiptName}</p>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setReceipt(null);
                    setReceiptName(null);
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <label className="mt-2 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line text-sm text-ink-soft hover:bg-paper-sunken">
                <ImagePlus className="size-4" />
                Attach a photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => void onFile(e.target.files?.[0])}
                />
              </label>
            )}
          </div>
          <Button
            className="w-full"
            disabled={mut.isPending || paise <= 0 || title.trim().length < 1}
            onClick={() => mut.mutate()}
          >
            {mut.isPending
              ? "Saving…"
              : `Log ${paise ? formatMoney(paise, detail.book.currency) : "expense"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

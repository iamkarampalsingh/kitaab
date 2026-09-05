import { BookOpen } from "lucide-react";
import { CASHFLOW_COPY, type Cashflow, type CoverTone } from "@/lib/kitaab/constants";
import { cn } from "@/lib/utils";

const TONE: Record<CoverTone, string> = {
  linen: "bg-cover-linen text-ink",
  moss: "bg-cover-moss text-pine-fg",
  clay: "bg-cover-clay text-pine-fg",
  steel: "bg-cover-steel text-pine-fg",
  dusk: "bg-cover-dusk text-pine-fg",
  ink: "bg-cover-ink text-pine-fg",
};

export function BookCover({
  title,
  cashflow,
  coverTone,
  className,
  compact,
}: {
  title: string;
  cashflow: Cashflow;
  coverTone: CoverTone;
  className?: string;
  compact?: boolean;
}) {
  const light = coverTone === "linen";
  return (
    <div
      className={cn(
        "book-spine linen-noise relative overflow-hidden rounded-r-xl rounded-l-sm shadow-[var(--shadow-book)]",
        TONE[coverTone],
        compact ? "aspect-[3/4] min-h-36" : "aspect-[3/4]",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-2.5",
          light ? "bg-ink/15" : "bg-ink/30",
        )}
      />
      <div className="flex h-full flex-col justify-between p-4 pl-6">
        <div>
          <p
            className={cn(
              "text-[10px] font-medium tracking-[0.18em] uppercase",
              light ? "text-ink-soft" : "text-pine-fg/70",
            )}
          >
            {CASHFLOW_COPY[cashflow]?.label ?? "Book"}
          </p>
          <h3
            className={cn(
              "mt-2 font-display text-lg leading-snug font-semibold tracking-tight",
              compact && "text-base",
            )}
          >
            {title}
          </h3>
        </div>
        <BookOpen
          className={cn("size-5", light ? "text-ink/40" : "text-pine-fg/50")}
          strokeWidth={1.5}
        />
      </div>
    </div>
  );
}

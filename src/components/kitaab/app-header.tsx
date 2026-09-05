import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BookOpen } from "lucide-react";

export function AppHeader({ right }: { right?: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" className="flex items-center gap-2 text-ink">
          <span className="grid size-8 place-items-center rounded-lg bg-pine text-pine-fg">
            <BookOpen className="size-4" strokeWidth={1.75} />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">Kitaab</span>
        </Link>
        <div className="flex items-center gap-3">
          {right}
          {isPending ? (
            <div className="size-8 animate-pulse rounded-full bg-paper-sunken" />
          ) : user ? (
            <div className="max-w-[42vw] truncate text-ink [&_button]:text-ink-soft [&_span]:text-sm">
              <UserButton />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

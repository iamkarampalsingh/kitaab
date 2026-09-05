import { avatarTone, cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  image,
  id,
  size = "md",
}: {
  name: string;
  image?: string | null;
  id: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "sm" ? "size-7 text-[10px]" : size === "lg" ? "size-12 text-base" : "size-9 text-xs";
  if (image) {
    return (
      <img
        src={image}
        alt=""
        className={cn(
          "rounded-full object-cover outline outline-1 -outline-offset-1 outline-ink/10",
          dim,
        )}
      />
    );
  }
  return (
    <span
      className={cn(
        "grid place-items-center rounded-full font-medium",
        dim,
        avatarTone(id),
      )}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({
  people,
}: {
  people: { id: string; name: string; image?: string | null }[];
}) {
  const shown = people.slice(0, 4);
  const extra = people.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((p) => (
        <span key={p.id} className="ring-2 ring-paper rounded-full">
          <Avatar id={p.id} name={p.name} image={p.image} size="sm" />
        </span>
      ))}
      {extra > 0 ? (
        <span className="grid size-7 place-items-center rounded-full bg-paper-sunken text-[10px] font-medium text-ink-soft ring-2 ring-paper">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

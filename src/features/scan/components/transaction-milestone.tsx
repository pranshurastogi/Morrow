import { Check, Circle, type LucideIcon } from "lucide-react";

export function TransactionMilestone({
  complete,
  active,
  icon: Icon,
  title,
  detail,
}: {
  complete: boolean;
  active: boolean;
  icon: LucideIcon;
  title: string;
  detail: string;
}) {
  return (
    <li
      className={`sandbox-milestone relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-5 last:pb-0 ${
        active ? "sandbox-milestone-active" : ""
      }`}
      aria-current={active ? "step" : undefined}
    >
      <span
        className={`relative z-10 grid h-8 w-8 place-items-center rounded-full border ${
          complete
            ? "border-primary bg-primary text-primary-foreground"
            : active
              ? "border-brass bg-secondary text-foreground"
              : "border-border bg-parchment text-muted-foreground"
        }`}
      >
        {complete ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : active ? (
          <Icon className="h-4 w-4" aria-hidden />
        ) : (
          <Circle className="h-3 w-3" aria-hidden />
        )}
      </span>
      <div className="pt-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {detail}
        </p>
      </div>
    </li>
  );
}

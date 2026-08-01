import { Archive, Compass, Package, UserRound, Zap } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const sections = [
  { icon: Compass, label: "Scan", to: "/scan" },
  { icon: Zap, label: "Requests", to: "/requests" },
  { icon: Package, label: "Dispatches", to: "/dispatches" },
  { icon: Archive, label: "Archive", to: "/archive" },
  { icon: UserRound, label: "Account", to: "/account" },
] as const;

export function ScanNavigation({ onScan }: { onScan?: () => void }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-parchment/95 backdrop-blur-sm"
      aria-label="Sections"
    >
      <ul className="mx-auto grid max-w-[680px] grid-cols-5">
        {sections.map((item) => (
          <li key={item.label}>
            <Link
              to={item.to}
              onClick={item.to === "/scan" ? onScan : undefined}
              aria-current={pathname === item.to ? "page" : undefined}
              className={cn(
                "flex min-h-16 w-full flex-col items-center justify-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                pathname === item.to
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-secondary/55 hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" aria-hidden />
              <span className="label-caps">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

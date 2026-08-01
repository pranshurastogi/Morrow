import { Archive, Compass, Package, Zap } from "lucide-react";

export function ScanNavigation({ onScan }: { onScan: () => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-parchment/95 backdrop-blur-sm"
      aria-label="Sections"
    >
      <ul className="mx-auto grid max-w-[560px] grid-cols-4">
        {[
          { icon: Compass, label: "Scan", enabled: true },
          { icon: Zap, label: "Requests", enabled: false },
          { icon: Package, label: "Dispatches", enabled: false },
          { icon: Archive, label: "Archive", enabled: false },
        ].map((item) => (
          <li key={item.label}>
            <button
              type="button"
              onClick={item.enabled ? onScan : undefined}
              disabled={!item.enabled}
              aria-current={item.enabled ? "page" : undefined}
              className={`flex min-h-14 w-full flex-col items-center justify-center gap-1 ${
                item.enabled ? "text-primary" : "text-muted-foreground/55"
              }`}
            >
              <item.icon className="h-4 w-4" aria-hidden />
              <span className="label-caps">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

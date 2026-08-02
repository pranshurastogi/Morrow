import { ExternalLink, ShoppingBag } from "lucide-react";
import { Plate, StatusStamp } from "@/components/morrow/bits";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Candidate, ScanRecord } from "../api/types";
import {
  buildExternalCatalogLinks,
  buildExternalCatalogQuery,
} from "../model/external-catalog";

export function ExternalCatalogLinks({
  scan,
  candidate,
  className,
}: {
  scan: ScanRecord;
  candidate?: Candidate | null;
  className?: string;
}) {
  const query = buildExternalCatalogQuery({ scan, candidate });
  const links = buildExternalCatalogLinks(query);
  if (links.length === 0) return null;

  return (
    <Plate as="section" className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <ShoppingBag
            className="mt-0.5 h-5 w-5 shrink-0 text-brass"
            aria-hidden
          />
          <div>
            <h2 className="font-display text-lg">Wider catalogue handoff</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Search outside the connected merchant network using Morrow’s
              current product description.
            </p>
          </div>
        </div>
        <StatusStamp tone="unverified" className="text-center">
          External
        </StatusStamp>
      </div>

      <p className="mt-3 border-y border-border py-2 font-mono text-[11px] text-muted-foreground">
        QUERY · {query}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {links.map((link) => (
          <Button key={link.id} asChild variant="outline" className="min-h-11">
            <a
              href={link.href}
              target="_blank"
              rel="external nofollow noopener noreferrer"
            >
              {link.label}
              <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
            </a>
          </Button>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        External results are references only. Morrow has not verified their
        seller, variant, price, stock, delivery, or checkout.
      </p>
    </Plate>
  );
}

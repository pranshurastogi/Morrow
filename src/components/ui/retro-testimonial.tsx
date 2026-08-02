import type { ReactNode } from "react";
import { Archive, ImageOff, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Carousel as BaseCarousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface RetroResearchFact {
  label: string;
  value: string;
}

export interface RetroResearchItem {
  id: string;
  catalogueNumber: string;
  title: string;
  subtitle: string;
  summary: string;
  imageUrl: string | null;
  statusLabel: string;
  statusTone: "verified" | "similar" | "uncertain" | "stopped";
  inspectedAt: string;
  sourceLabel: string | null;
  facts: RetroResearchFact[];
}

const toneClass: Record<RetroResearchItem["statusTone"], string> = {
  verified: "border-primary text-primary",
  similar: "border-brass text-brass",
  uncertain: "border-muted-foreground text-muted-foreground",
  stopped: "border-postal text-postal",
};

function CatalogueImage({ item }: { item: RetroResearchItem }) {
  return (
    <div className="archive-catalogue-image relative grid aspect-[4/3] place-items-center overflow-hidden border-b border-border bg-secondary/45">
      <div className="absolute inset-3 border border-brass/35" aria-hidden />
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.title}
          className="h-full w-full object-contain p-5 mix-blend-multiply"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.hidden = true;
            event.currentTarget.nextElementSibling?.removeAttribute("hidden");
          }}
        />
      ) : null}
      <div
        hidden={Boolean(item.imageUrl)}
        className="relative z-10 text-center text-muted-foreground"
      >
        <ImageOff className="mx-auto h-8 w-8" aria-hidden />
        <p className="mono-caps mt-2">Image not retained</p>
      </div>
      <span className="absolute left-3 top-3 border border-border bg-parchment/95 px-2 py-1 font-mono text-[9px] tracking-[0.14em] text-brass">
        {item.catalogueNumber}
      </span>
    </div>
  );
}

function ResearchCard({
  item,
  renderExpanded,
}: {
  item: RetroResearchItem;
  renderExpanded?: (item: RetroResearchItem) => ReactNode;
}) {
  return (
    <Dialog>
      <article className="archive-catalogue-card h-full overflow-hidden border border-border bg-card shadow-[var(--shadow-plate)]">
        <DialogTrigger asChild>
          <button
            type="button"
            className="group flex h-full min-h-[27rem] w-full flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            aria-label={`Open research record for ${item.title}`}
          >
            <CatalogueImage item={item} />
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="label-caps text-postal">Research record</p>
                <span
                  className={cn(
                    "rotate-[-2deg] border-2 border-double px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]",
                    toneClass[item.statusTone],
                  )}
                >
                  {item.statusLabel}
                </span>
              </div>
              <h3 className="mt-3 font-display text-2xl leading-tight">
                {item.title}
              </h3>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-brass">
                {item.subtitle}
              </p>
              <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                {item.summary}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-px border border-border bg-border">
                {item.facts.slice(0, 4).map((fact) => (
                  <div key={fact.label} className="bg-card p-2.5">
                    <dt className="mono-caps text-muted-foreground">
                      {fact.label}
                    </dt>
                    <dd className="mt-1 truncate text-xs font-medium">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <span className="mt-auto flex items-center gap-2 border-t border-border pt-4 text-sm font-medium text-primary">
                <Search className="h-4 w-4" aria-hidden />
                Open dossier
              </span>
            </div>
          </button>
        </DialogTrigger>
      </article>

      <DialogContent className="archive-dossier-dialog left-0 top-auto bottom-0 max-h-[92dvh] w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-t-md border-x-0 border-b-0 p-0 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-sm sm:border">
        <DialogHeader className="border-b border-border p-5 pr-14 text-left">
          <p className="label-caps text-postal">Morrow research dossier</p>
          <DialogTitle className="font-display text-3xl font-medium leading-tight">
            {item.title}
          </DialogTitle>
          <DialogDescription className="font-mono text-[10px] uppercase tracking-[0.12em] text-brass">
            {item.catalogueNumber} · {item.inspectedAt}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-0 sm:grid-cols-[15rem_minmax(0,1fr)]">
          <div className="border-b border-border sm:border-r sm:border-b-0">
            <CatalogueImage item={item} />
            <div className="p-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {item.summary}
              </p>
              {item.sourceLabel ? (
                <p className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-brass">
                  <Archive className="h-3.5 w-3.5" aria-hidden />
                  {item.sourceLabel}
                </p>
              ) : null}
            </div>
          </div>
          <div className="p-5">{renderExpanded?.(item)}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RetroResearchCarousel({
  items,
  renderExpanded,
  className,
}: {
  items: RetroResearchItem[];
  renderExpanded?: (item: RetroResearchItem) => ReactNode;
  className?: string;
}) {
  return (
    <BaseCarousel
      opts={{ align: "start", containScroll: "trimSnaps" }}
      className={cn("w-full", className)}
      aria-label="Researched product records"
    >
      <CarouselContent className="py-2">
        {items.map((item) => (
          <CarouselItem
            key={item.id}
            className="basis-[88%] sm:basis-[64%] lg:basis-[48%]"
          >
            <ResearchCard
              item={item}
              {...(renderExpanded ? { renderExpanded } : {})}
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      <div className="mt-3 flex justify-end gap-2" aria-label="Archive pages">
        <CarouselPrevious className="static h-11 w-11 translate-y-0 rounded-sm border-brass/60 bg-card text-primary hover:bg-secondary"></CarouselPrevious>
        <CarouselNext className="static h-11 w-11 translate-y-0 rounded-sm border-brass/60 bg-card text-primary hover:bg-secondary"></CarouselNext>
      </div>
    </BaseCarousel>
  );
}

import { ArrowRight, Camera } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { StatusStamp } from "@/components/morrow/bits";

export function TechnologyCta() {
  return (
    <section className="border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-7 px-4 py-14 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div>
          <StatusStamp className="border-primary-foreground/70 text-primary-foreground">
            Field test
          </StatusStamp>
          <h2 className="mt-5 max-w-2xl text-balance text-3xl sm:text-4xl">
            Now give the machinery something real to inspect.
          </h2>
          <p className="mt-3 text-sm text-primary-foreground/75">
            Show it. Verify it. Get it.
          </p>
        </div>
        <Button
          size="lg"
          variant="secondary"
          className="min-h-12 min-w-48"
          asChild
        >
          <Link to="/scan">
            <Camera className="h-4 w-4" aria-hidden />
            Open Morrow
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}

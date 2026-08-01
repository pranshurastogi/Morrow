import { Link } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import heroScene from "@/assets/hero-1900-tomorrow.jpg";
import { Button } from "@/components/ui/button";
import { Plate, SectionKicker, StatusStamp } from "../bits";

export function Hero() {
  return (
    <section className="relative overflow-hidden era-gradient surface-grain">
      <div className="mx-auto max-w-6xl px-4 pt-10 pb-14 sm:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="hero-copy mx-auto w-full max-w-[640px]">
            <SectionKicker index="MOR-1907-1842">
              Mercantile intelligence
            </SectionKicker>
            <h1 className="mt-5 text-balance font-display text-[2.6rem] leading-[1.02] sm:text-6xl">
              The buy button for the physical world.
            </h1>
            <p className="mt-5 max-w-prose text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              Show it once. Morrow identifies the exact product, checks the
              seller, and buys only with your permission.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="min-h-12 flex-1 text-base" asChild>
                <Link to="/scan">
                  <Camera className="mr-2 h-5 w-5" aria-hidden />
                  Get this
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-12 flex-1 text-base"
                asChild
              >
                <a href="#how">See it work</a>
              </Button>
            </div>

            <p className="mt-5 mono-caps text-muted-foreground">
              See it <span className="text-brass">→</span> verify it{" "}
              <span className="text-brass">→</span>{" "}
              <span className="text-primary">get it</span>
            </p>
          </div>

          <div className="hero-plate relative">
            <Plate className="overflow-hidden">
              <img
                src={heroScene}
                alt="Illustration: a 1900 parcel-office clerk with a paper catalogue beside a modern customer photographing an object with a phone"
                width={1280}
                height={960}
                className="w-full"
              />
              <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
                <figure className="p-3">
                  <figcaption className="mono-caps text-muted-foreground">
                    1900
                  </figcaption>
                  <blockquote className="mt-1 font-display text-[15px] leading-snug">
                    “Might I acquire one of these?”
                  </blockquote>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Certainly. Allow six to eight weeks.
                  </p>
                </figure>
                <figure className="p-3">
                  <figcaption className="mono-caps text-primary">
                    Tomorrow
                  </figcaption>
                  <blockquote className="mt-1 font-display text-[15px] leading-snug">
                    “Get this.”
                  </blockquote>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Exact match verified. Arriving tomorrow.
                  </p>
                </figure>
              </div>
            </Plate>
            <div className="absolute -top-3 right-3">
              <StatusStamp tone="postal">Inspected &amp; verified</StatusStamp>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

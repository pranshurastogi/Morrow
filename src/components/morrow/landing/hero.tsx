import { Link } from "@tanstack/react-router";
import { Camera, Fingerprint, PackageCheck, ScanLine } from "lucide-react";
import merchantStory from "@/assets/merchant-of-tomorrow-story.jpg";
import { Button } from "@/components/ui/button";
import { Plate, SectionKicker, StatusStamp } from "../bits";

const journey = [
  { icon: Camera, label: "Take one picture" },
  { icon: ScanLine, label: "Verify the exact item" },
  { icon: Fingerprint, label: "Approve with a passkey" },
];

export function Hero() {
  return (
    <section className="merchant-hero relative overflow-hidden era-gradient surface-grain">
      <div className="mx-auto max-w-6xl px-4 pb-14 pt-9 sm:pt-14 lg:pb-16">
        <div className="grid items-center gap-9 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-12">
          <div className="hero-copy mx-auto w-full max-w-[620px] lg:mx-0">
            <SectionKicker index="EST. 1900 → TOMORROW">
              Mercantile Co.
            </SectionKicker>
            <h1 className="mt-5 text-balance font-display text-[3.35rem] leading-[0.92] sm:text-7xl lg:text-[5.1rem]">
              Merchant
              <span className="block italic text-primary">of Tomorrow.</span>
            </h1>
            <p className="mt-5 max-w-lg font-display text-[1.35rem] leading-snug sm:text-2xl">
              A century of shopping, down to one picture.
            </p>
            <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              Grandad used a catalogue. Mum opened six tabs. You show the
              object; Morrow verifies it and asks for your passkey before any
              payment moves.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="min-h-12 flex-1 text-base" asChild>
                <Link to="/scan">
                  <Camera className="mr-2 h-5 w-5" aria-hidden />
                  Open Morrow
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-12 flex-1 text-base"
                asChild
              >
                <a href="#how">
                  <ScanLine className="mr-2 h-4 w-4" aria-hidden />
                  Watch it inspect
                </a>
              </Button>
            </div>

            <ol className="hero-journey mt-6 grid grid-cols-3 border-y border-border py-3">
              {journey.map((item, index) => (
                <li
                  key={item.label}
                  className="hero-journey-step flex min-w-0 flex-col gap-1.5 px-2 first:pl-0 last:pr-0"
                >
                  <span className="flex items-center gap-1.5 text-primary">
                    <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="font-mono text-[10px] text-brass">
                      0{index + 1}
                    </span>
                  </span>
                  <span className="text-pretty text-xs leading-snug text-muted-foreground">
                    {item.label}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="hero-plate relative">
            <Plate className="hero-story-plate overflow-hidden">
              <figure>
                <div className="hero-story-frame">
                  <img
                    src={merchantStory}
                    alt="An Indian grandfather reads a household catalogue while a woman photographs an object and a parcel is prepared for secure dispatch"
                    width={1672}
                    height={941}
                    fetchPriority="high"
                    className="hero-story-image"
                  />
                  <div className="hero-story-past" aria-hidden="true">
                    <img
                      src={merchantStory}
                      alt=""
                      width={1672}
                      height={941}
                      className="hero-story-image"
                    />
                  </div>
                  <span className="hero-story-beam" aria-hidden="true" />
                  <span
                    className="hero-story-corner"
                    data-corner="tl"
                    aria-hidden="true"
                  />
                  <span
                    className="hero-story-corner"
                    data-corner="tr"
                    aria-hidden="true"
                  />
                  <span
                    className="hero-story-corner"
                    data-corner="bl"
                    aria-hidden="true"
                  />
                  <span
                    className="hero-story-corner"
                    data-corner="br"
                    aria-hidden="true"
                  />
                  <div className="hero-story-live-label" aria-hidden="true">
                    <span className="hero-story-live-dot" />
                    Object in view
                  </div>
                </div>
                <figcaption className="hero-time-rail grid grid-cols-3 divide-x divide-border border-t border-border bg-card">
                  <span className="p-3">
                    <span className="block mono-caps text-muted-foreground">
                      1900
                    </span>
                    <span className="mt-1 block font-display text-sm">
                      Find the page
                    </span>
                  </span>
                  <span className="p-3 text-center">
                    <span className="block mono-caps text-primary">Today</span>
                    <span className="mt-1 block font-display text-sm">
                      Take the picture
                    </span>
                  </span>
                  <span className="p-3 text-right">
                    <span className="block mono-caps text-brass">Next</span>
                    <span className="mt-1 block font-display text-sm">
                      Approve once
                    </span>
                  </span>
                </figcaption>
              </figure>
            </Plate>
            <div className="absolute -top-3 right-3">
              <StatusStamp tone="postal">Picture received</StatusStamp>
            </div>
            <div className="absolute -bottom-3 left-3 hidden sm:block">
              <StatusStamp tone="verified" animate>
                <PackageCheck className="h-3.5 w-3.5" aria-hidden />
                Ready to verify
              </StatusStamp>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

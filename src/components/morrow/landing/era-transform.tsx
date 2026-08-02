import { useEffect, useRef, useState } from "react";
import { BookOpenText, Camera, Fingerprint } from "lucide-react";
import { Plate, SectionKicker } from "../bits";

const chapters = [
  {
    era: "1900",
    icon: BookOpenText,
    title: "Grandad points.",
    body: "A clerk finds the page.",
  },
  {
    era: "Today",
    icon: Camera,
    title: "Mum takes a picture.",
    body: "No product name to remember.",
  },
  {
    era: "Tomorrow",
    icon: Fingerprint,
    title: "One passkey approves it.",
    body: "One exact item. One bounded payment.",
  },
];

export function EraTransform() {
  const sectionRef = useRef<HTMLElement>(null);
  const played = useRef(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const timeouts: number[] = [];

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || played.current) return;
        played.current = true;
        observer.disconnect();

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setActive(chapters.length - 1);
          return;
        }

        chapters.forEach((_, index) => {
          timeouts.push(window.setTimeout(() => setActive(index), index * 720));
        });
      },
      { threshold: 0.35 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="era"
      className="border-y border-border bg-card"
    >
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-14">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-end">
          <div>
            <SectionKicker index="01">One family, one request</SectionKicker>
            <h2 className="mt-4 max-w-xl text-balance text-3xl sm:text-4xl">
              Same small ask. Three generations.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              Point to the thing. Merchant of Tomorrow handles the catalogue.
            </p>
          </div>

          <Plate className="family-story overflow-hidden">
            <ol className="family-story-rail grid sm:grid-cols-3">
              {chapters.map((chapter, index) => {
                const state =
                  index < active
                    ? "complete"
                    : index === active
                      ? "current"
                      : "upcoming";

                return (
                  <li
                    key={chapter.era}
                    className="family-story-chapter"
                    data-state={state}
                  >
                    <button
                      type="button"
                      onClick={() => setActive(index)}
                      className="family-story-button min-h-36 w-full p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                      aria-pressed={index === active}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="mono-caps text-brass">
                          {chapter.era}
                        </span>
                        <span className="family-story-icon" aria-hidden="true">
                          <chapter.icon className="h-5 w-5" />
                        </span>
                      </span>
                      <span className="mt-7 block font-display text-xl leading-tight">
                        {chapter.title}
                      </span>
                      <span className="mt-2 block text-sm text-muted-foreground">
                        {chapter.body}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="family-story-track" aria-hidden="true">
              <span
                className="family-story-progress"
                style={{
                  width: `${active < 0 ? 0 : ((active + 1) / chapters.length) * 100}%`,
                }}
              />
            </div>
          </Plate>
        </div>
      </div>
    </section>
  );
}

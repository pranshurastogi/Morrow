import { Plate, SectionKicker, StatusStamp } from "../bits";

const useCases = [
  {
    title: "Refill it",
    body: "Photograph an empty product. The exact variant is reordered.",
    stamp: "Exact",
  },
  {
    title: "Replace it",
    body: "Photograph a broken or depleted component. Compatibility is verified before purchase.",
    stamp: "Compatible",
  },
  {
    title: "Find it",
    body: "Upload a fashion or décor screenshot. Get the exact item, or a clearly labelled alternative.",
    stamp: "Similar",
  },
  {
    title: "Remember it",
    body: "Photograph an object while travelling. Save it now, purchase it when you are ready.",
    stamp: "Saved",
  },
  {
    title: "Help them",
    body: "A parent sends a photograph. Morrow handles identification, comparison and payment approval.",
    stamp: "Assisted",
  },
  {
    title: "Source it",
    body: "A business user photographs a part or supply. Morrow checks availability and delivery urgency.",
    stamp: "Dispatched",
  },
];

export function UseCases() {
  return (
    <section
      id="merchants"
      className="border-y border-border bg-card surface-grain"
    >
      <div className="mx-auto max-w-6xl px-4 py-14">
        <SectionKicker index="05">In the world</SectionKicker>
        <h2 className="mt-4 max-w-2xl text-balance text-3xl sm:text-4xl">
          Six ordinary moments Morrow was built for.
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((useCase) => (
            <Plate as="li" key={useCase.title} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl leading-tight">{useCase.title}</h3>
                <StatusStamp tone="info">{useCase.stamp}</StatusStamp>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {useCase.body}
              </p>
            </Plate>
          ))}
        </ul>
      </div>
    </section>
  );
}

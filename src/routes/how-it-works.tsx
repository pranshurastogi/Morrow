import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/morrow/site-nav";
import { SiteFooter } from "@/components/morrow/landing";
import {
  DecisionEngine,
  DurableWorkflow,
  InspectionPipeline,
  OperationsBoard,
  RetrievalObservatory,
  RuntimeMap,
  TechnologyCta,
  TechnologyHero,
} from "@/components/morrow/technology";

const title = "How Morrow Works — Technical Field Manual";
const description =
  "See Morrow's production architecture: evidence extraction, hybrid retrieval, deterministic verification, durable queues, and Prava-bounded checkout.";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/merchant-of-tomorrow-og.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HowItWorks,
});

function HowItWorks() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main>
        <TechnologyHero />
        <RuntimeMap />
        <InspectionPipeline />
        <RetrievalObservatory />
        <DecisionEngine />
        <DurableWorkflow />
        <OperationsBoard />
        <TechnologyCta />
      </main>
      <SiteFooter />
    </div>
  );
}

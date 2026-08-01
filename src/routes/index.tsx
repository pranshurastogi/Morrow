import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/morrow/site-nav";
import {
  EraTransform,
  FinalCta,
  Hero,
  LiveDemo,
  PravaInfrastructure,
  PurchaseAuthority,
  SimilarNotEnough,
  SiteFooter,
  UseCases,
} from "@/components/morrow/landing";

const title = "Morrow — The buy button for the physical world";
const description =
  "Photograph anything. Morrow identifies it, verifies the exact version, compares trusted sellers, and completes the purchase through Prava within your approved limit.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "Morrow — Show it. Verify it. Get it.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/og.png" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main>
        <Hero />
        <EraTransform />
        <LiveDemo />
        <SimilarNotEnough />
        <PurchaseAuthority />
        <UseCases />
        <PravaInfrastructure />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

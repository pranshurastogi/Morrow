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
} from "@/components/morrow/landing";

const title = "Merchant of Tomorrow — Show it. Verify it. Get it.";
const description =
  "Take one picture. Merchant of Tomorrow verifies the exact product, compares an orderable offer, and asks for your passkey before spending.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content: "/merchant-of-tomorrow-og.jpg",
      },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "Merchant of Tomorrow — Show it. Verify it. Get it.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:image",
        content: "/merchant-of-tomorrow-og.jpg",
      },
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
        <PravaInfrastructure />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

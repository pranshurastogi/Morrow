import { Link } from "@tanstack/react-router";
import seal from "@/assets/morrow-seal.png";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section className="era-gradient surface-grain">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <img
          src={seal}
          alt="The Morrow seal: a brass lens, a parcel mark and the letter M"
          width={816}
          height={816}
          loading="lazy"
          className="mx-auto h-20 w-20"
        />
        <h2 className="mt-7 text-balance text-3xl sm:text-4xl">
          Take the picture. Leave the tabs behind.
        </h2>
        <p className="mx-auto mt-4 max-w-prose text-sm text-muted-foreground">
          Merchant of Tomorrow will ask before it spends.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" className="min-h-12 text-base" asChild>
            <Link to="/scan">Open Morrow</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="min-h-12 text-base"
            asChild
          >
            <a href="#how">Explore the product</a>
          </Button>
        </div>
        <p className="mt-5 mono-caps text-muted-foreground">
          Payments secured through Prava
        </p>
      </div>
    </section>
  );
}

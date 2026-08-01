import { ClerkLoading, Show, UserButton } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { ArchiveNumber } from "@/components/morrow/bits";
import { Button } from "@/components/ui/button";

export function ScanHeader({
  deskLabel = "Object desk",
}: {
  deskLabel?: string;
}) {
  return (
    <header className="sticky top-0 z-40 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-parchment/92 px-3 py-2 backdrop-blur-sm">
      <Button variant="ghost" size="icon" className="h-11 w-11" asChild>
        <Link to="/" aria-label="Back to the landing page">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
      </Button>
      <div className="min-w-0 text-center">
        <p className="truncate font-display text-lg leading-none">Morrow</p>
        <p className="mono-caps text-muted-foreground">{deskLabel}</p>
      </div>
      <div className="flex h-11 w-11 items-center justify-center">
        <ClerkLoading>
          <ArchiveNumber value="1842" />
        </ClerkLoading>
        <Show when="signed-out">
          <ArchiveNumber value="1842" />
        </Show>
        <Show when="signed-in">
          <UserButton
            appearance={{
              elements: {
                userButtonTrigger: "h-11 w-11 focus-visible:outline-none",
                userButtonAvatarBox: "h-9 w-9",
              },
            }}
          />
        </Show>
      </div>
    </header>
  );
}

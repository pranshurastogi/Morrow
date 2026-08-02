import { ClerkLoading, Show } from "@clerk/tanstack-react-start";
import { AuthenticationDesk } from "@/features/auth/authentication-desk";
import { ScanHeader } from "@/features/scan/components/scan-header";
import { ScanNavigation } from "@/features/scan/components/scan-navigation";
import { ArchivePage } from "./archive-page";
import { DeskSectionPage, type DeskSection } from "./desk-section-page";

const routeBySection = {
  requests: "/requests",
  dispatches: "/dispatches",
  archive: "/archive",
} as const;

const labelBySection = {
  requests: "Request ledger",
  dispatches: "Dispatch board",
  archive: "Inspection archive",
} as const;

export function AuthenticatedDeskRoute({ section }: { section: DeskSection }) {
  return (
    <div className="min-h-screen bg-background pb-20">
      <ScanHeader deskLabel={labelBySection[section]} />
      <ClerkLoading>
        <main className="mx-auto w-full max-w-[560px] px-4 py-5">
          <div
            className="ledger-card flex min-h-48 items-center justify-center p-6 text-center"
            role="status"
          >
            <p className="mono-caps text-muted-foreground">
              Opening the private ledger
            </p>
          </div>
        </main>
      </ClerkLoading>
      <Show when="signed-out">
        <AuthenticationDesk returnTo={routeBySection[section]} />
      </Show>
      <Show when="signed-in">
        {section === "archive" ? (
          <ArchivePage />
        ) : (
          <DeskSectionPage section={section} />
        )}
        <ScanNavigation />
      </Show>
    </div>
  );
}

import { ClerkLoading, Show } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { AccountDesk } from "@/features/account/components/account-desk";
import { AuthenticationDesk } from "@/features/auth/authentication-desk";
import { ScanHeader } from "@/features/scan/components/scan-header";
import { ScanNavigation } from "@/features/scan/components/scan-navigation";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account — Morrow" },
      {
        name: "description",
        content:
          "Manage Morrow delivery records and Prava-enrolled card references.",
      },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <ScanHeader deskLabel="Customer ledger" />
      <ClerkLoading>
        <main className="mx-auto w-full max-w-[680px] px-4 py-5">
          <div
            className="ledger-card flex min-h-48 items-center justify-center p-6 text-center"
            role="status"
          >
            <p className="mono-caps text-muted-foreground">
              Opening the customer ledger
            </p>
          </div>
        </main>
      </ClerkLoading>
      <Show when="signed-out">
        <AuthenticationDesk returnTo="/account" />
      </Show>
      <Show when="signed-in">
        <AccountDesk />
        <ScanNavigation />
      </Show>
    </div>
  );
}

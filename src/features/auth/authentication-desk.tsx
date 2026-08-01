import { SignInButton, SignUpButton } from "@clerk/tanstack-react-start";
import { BadgeCheck, KeyRound, ReceiptText } from "lucide-react";

import seal from "@/assets/morrow-seal.png";
import { Button } from "@/components/ui/button";

export function AuthenticationDesk({
  returnTo = "/scan",
}: {
  returnTo?: string;
}) {
  return (
    <main className="mx-auto w-full max-w-[600px] px-4 py-6 sm:py-10">
      <section
        className="auth-ledger plate surface-grain overflow-hidden bg-card"
        aria-labelledby="sign-in-title"
      >
        <div className="flex items-center justify-between border-b border-ink/20 bg-primary px-4 py-2.5 text-primary-foreground sm:px-6">
          <p className="mono-caps">Private entry ledger</p>
          <p className="font-mono text-[10px] tracking-[0.12em] opacity-75">
            MM–1842
          </p>
        </div>

        <div className="grid sm:grid-cols-[132px_minmax(0,1fr)]">
          <div className="flex items-center justify-center border-b border-border bg-secondary/45 p-5 sm:border-r sm:border-b-0">
            <div className="auth-seal relative grid h-24 w-24 place-items-center rounded-full border border-brass/70 bg-ivory">
              <img src={seal} alt="" className="h-20 w-20" />
            </div>
          </div>

          <div className="px-5 py-7 sm:px-7 sm:py-8">
            <p className="label-caps text-postal">Account required</p>
            <h1
              id="sign-in-title"
              className="mt-2 max-w-sm font-display text-[2.15rem] leading-[1.02]"
            >
              Your object desk is private by design.
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              Sign in to keep inspections, purchase limits, and dispatch records
              attached to you.
            </p>

            <ul className="mt-5 grid gap-2 border-y border-border py-4 text-sm">
              <li className="flex items-center gap-2.5">
                <BadgeCheck className="h-4 w-4 text-primary" aria-hidden />
                Evidence stays attached to each exact-match claim.
              </li>
              <li className="flex items-center gap-2.5">
                <KeyRound className="h-4 w-4 text-primary" aria-hidden />
                Purchase authority remains item and amount bounded.
              </li>
              <li className="flex items-center gap-2.5">
                <ReceiptText className="h-4 w-4 text-primary" aria-hidden />
                Completed dispatches receive a durable record.
              </li>
            </ul>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <SignInButton mode="modal" forceRedirectUrl={returnTo}>
                <Button size="lg" className="h-11 w-full">
                  Sign in
                </Button>
              </SignInButton>
              <SignUpButton mode="modal" forceRedirectUrl={returnTo}>
                <Button variant="outline" size="lg" className="h-11 w-full">
                  Create account
                </Button>
              </SignUpButton>
            </div>

            <p className="mono-caps mt-5 text-center text-muted-foreground sm:text-left">
              Show it · Verify it · Get it
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

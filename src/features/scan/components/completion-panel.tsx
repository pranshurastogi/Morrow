import { Link } from "@tanstack/react-router";
import { CircleAlert, PackageCheck } from "lucide-react";
import { Plate, StatusStamp } from "@/components/morrow/bits";
import { Button } from "@/components/ui/button";
import type { PublicPaymentResult } from "../api/types";

export function CompletionPanel({
  result,
  onReset,
}: {
  result: PublicPaymentResult | null;
  onReset: () => void;
}) {
  return (
    <section className="receipt-enter py-8 text-center">
      <StatusStamp animate tone="postal" className="text-base">
        Secured
      </StatusStamp>
      <PackageCheck
        className="mx-auto mt-6 h-10 w-10 text-primary"
        aria-hidden
      />
      <h1 className="mt-4 text-3xl">The order is confirmed.</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Merchant checkout and Prava's final payment state both completed.
      </p>
      <Plate className="mt-5 p-4 text-left">
        <dl className="divide-y divide-border border-y border-border">
          <div className="flex justify-between gap-3 py-3">
            <dt className="text-sm text-muted-foreground">
              Prava order reference
            </dt>
            <dd className="font-mono text-xs">
              {result?.orderId ?? "Recorded"}
            </dd>
          </div>
          <div className="flex justify-between gap-3 py-3">
            <dt className="text-sm text-muted-foreground">Payment state</dt>
            <dd className="font-mono text-xs">Completed</dd>
          </div>
        </dl>
      </Plate>
      <Button variant="outline" className="mt-5 min-h-11 w-full" asChild>
        <Link to="/">Return to Morrow</Link>
      </Button>
      <button
        type="button"
        onClick={onReset}
        className="mt-4 min-h-11 text-sm underline underline-offset-4"
      >
        Inspect another object
      </button>
    </section>
  );
}

export function ErrorPanel({
  code,
  message,
  onReset,
}: {
  code: string;
  message: string;
  onReset: () => void;
}) {
  return (
    <section className="receipt-enter py-8" role="alert">
      <StatusStamp tone="postal">Stopped safely</StatusStamp>
      <CircleAlert className="mt-6 h-8 w-8 text-postal" aria-hidden />
      <h1 className="mt-4 text-3xl">Morrow did not proceed.</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {message}
      </p>
      <p className="mt-3 font-mono text-[11px] text-postal">{code}</p>
      <Button
        variant="outline"
        className="mt-6 min-h-11 w-full"
        onClick={onReset}
      >
        Begin another inspection
      </Button>
    </section>
  );
}

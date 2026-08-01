import { useAuth } from "@clerk/tanstack-react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Archive,
  Box,
  PackageCheck,
  Plus,
  ReceiptText,
} from "lucide-react";
import { Plate, StatusStamp } from "@/components/morrow/bits";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/morrow-api";
import { listOrders, listPurchaseIntents, listScans } from "../api/client";
import type {
  OrderSummary,
  PurchaseIntentSummary,
  ScanRecord,
} from "../api/types";

export type DeskSection = "requests" | "dispatches" | "archive";

interface DeskEntry {
  id: string;
  identifier: string;
  title: string;
  description: string;
  status: string;
  amount?: string;
  createdAt: string;
}

const sectionCopy = {
  requests: {
    deskLabel: "Request ledger",
    eyebrow: "Purchase authority",
    title: "Requests awaiting or using your approval.",
    description:
      "Each request is constrained to one item, merchant, amount, and expiry.",
    emptyTitle: "No purchase requests yet.",
    emptyBody: "Verify an object and choose a dispatch to prepare one.",
    icon: ReceiptText,
  },
  dispatches: {
    deskLabel: "Dispatch board",
    eyebrow: "Merchant orders",
    title: "Dispatches with a recorded outcome.",
    description:
      "A dispatch appears only after Morrow has a merchant order record.",
    emptyTitle: "No dispatches recorded.",
    emptyBody: "Completed merchant checkouts will be filed here.",
    icon: PackageCheck,
  },
  archive: {
    deskLabel: "Inspection archive",
    eyebrow: "Object records",
    title: "Your prior inspections and their evidence state.",
    description:
      "Exact, alternative, and uncertain outcomes stay clearly distinguished.",
    emptyTitle: "The archive is empty.",
    emptyBody: "Open an inspection to make the first record.",
    icon: Archive,
  },
} as const;

function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function productTitle(snapshot: Record<string, unknown>): string {
  const brand = typeof snapshot["brand"] === "string" ? snapshot["brand"] : "";
  const name =
    typeof snapshot["name"] === "string" ? snapshot["name"] : "Object";
  return [brand, name].filter(Boolean).join(" ");
}

function requestEntry(intent: PurchaseIntentSummary): DeskEntry {
  return {
    id: intent.id,
    identifier: `REQ–${intent.id.slice(0, 8).toUpperCase()}`,
    title: productTitle(intent.productSnapshot),
    description: `${intent.quantity} item${intent.quantity === 1 ? "" : "s"} · authority expires ${formatDate(intent.expiresAt)}`,
    status: intent.status,
    amount: formatMoney(intent.maxAuthorizedAmountMinor, intent.currency),
    createdAt: intent.createdAt,
  };
}

function orderEntry(order: OrderSummary): DeskEntry {
  return {
    id: order.id,
    identifier:
      order.merchantOrderId ?? `DSP–${order.id.slice(0, 8).toUpperCase()}`,
    title: productTitle(order.productSnapshot),
    description: `${order.merchantName} · ${order.quantity} item${order.quantity === 1 ? "" : "s"}`,
    status: order.status,
    amount: formatMoney(order.totalMinor, order.currency),
    createdAt: order.createdAt,
  };
}

function scanEntry(scan: ScanRecord): DeskEntry {
  const title = scan.observation
    ? [scan.observation.brand, scan.observation.productName]
        .filter(Boolean)
        .join(" ") || "Object inspection"
    : "Object inspection";
  return {
    id: scan.id,
    identifier: `INS–${scan.id.slice(0, 8).toUpperCase()}`,
    title,
    description: scan.errorMessage ?? `${scan.quantity} item inspection`,
    status: scan.errorCode ? "STOPPED" : scan.status,
    createdAt: scan.createdAt,
  };
}

function statusTone(
  status: string,
): "verified" | "postal" | "info" | "unverified" {
  if (
    ["COMPLETED", "DELIVERED", "ORDER_COMPLETED", "EXACT_VERIFIED"].includes(
      status,
    )
  ) {
    return "verified";
  }
  if (["FAILED", "EXPIRED", "CHECKOUT_FAILED", "STOPPED"].includes(status)) {
    return "postal";
  }
  if (
    ["AMBIGUOUS", "SIMILAR_FOUND", "REQUIRES_MORE_EVIDENCE"].includes(status)
  ) {
    return "unverified";
  }
  return "info";
}

async function loadEntries(
  section: DeskSection,
  accessToken: string,
): Promise<DeskEntry[]> {
  if (section === "requests") {
    return (await listPurchaseIntents(accessToken)).map(requestEntry);
  }
  if (section === "dispatches") {
    return (await listOrders(accessToken)).map(orderEntry);
  }
  return (await listScans(accessToken)).map(scanEntry);
}

export function DeskSectionPage({ section }: { section: DeskSection }) {
  const copy = sectionCopy[section];
  const Icon = copy.icon;
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const query = useQuery({
    queryKey: ["morrow-desk", section],
    enabled: isLoaded && isSignedIn,
    queryFn: async () => {
      const accessToken = await getToken();
      if (!accessToken) {
        throw new ApiError({
          code: "AUTH_REQUIRED",
          message:
            "Your account session could not be opened. Please sign in again.",
        });
      }
      return loadEntries(section, accessToken);
    },
    staleTime: 15_000,
  });

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-5">
      <section
        className="border-b border-border pb-5"
        aria-labelledby={`${section}-title`}
      >
        <p className="label-caps text-postal">{copy.eyebrow}</p>
        <div className="mt-2 flex items-start gap-3">
          <Icon className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden />
          <div>
            <h1
              id={`${section}-title`}
              className="font-display text-3xl leading-tight"
            >
              {copy.title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {copy.description}
            </p>
          </div>
        </div>
      </section>

      {query.isPending ? (
        <Plate
          className="mt-5 flex min-h-44 items-center justify-center p-6"
          as="section"
        >
          <p className="mono-caps text-muted-foreground" role="status">
            Opening {copy.deskLabel.toLowerCase()}
          </p>
        </Plate>
      ) : query.isError ? (
        <Plate className="mt-5 p-5" as="section">
          <div className="flex gap-3">
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-postal"
              aria-hidden
            />
            <div>
              <h2 className="font-display text-xl">
                The ledger could not be opened.
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {query.error instanceof Error
                  ? query.error.message
                  : "The service did not return a usable record."}
              </p>
            </div>
          </div>
          <Button
            className="mt-5 h-11 w-full"
            onClick={() => void query.refetch()}
          >
            Try again
          </Button>
        </Plate>
      ) : query.data.length === 0 ? (
        <Plate className="mt-5 p-6 text-center" as="section">
          <Box className="mx-auto h-8 w-8 text-brass" aria-hidden />
          <h2 className="mt-3 font-display text-2xl">{copy.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {copy.emptyBody}
          </p>
          <Button className="mt-5 h-11" asChild>
            <Link to="/scan">
              <Plus aria-hidden />
              Open Morrow
            </Link>
          </Button>
        </Plate>
      ) : (
        <ol className="mt-5 grid gap-3">
          {query.data.map((entry) => (
            <Plate key={entry.id} as="li" className="overflow-hidden">
              <article className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] tracking-[0.12em] text-brass">
                      {entry.identifier}
                    </p>
                    <h2 className="mt-1 truncate font-display text-xl">
                      {entry.title}
                    </h2>
                  </div>
                  <StatusStamp
                    tone={statusTone(entry.status)}
                    className="text-[9px]"
                  >
                    {entry.status.replaceAll("_", " ")}
                  </StatusStamp>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {entry.description}
                </p>
                <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-3">
                  <time
                    className="mono-caps text-muted-foreground"
                    dateTime={entry.createdAt}
                  >
                    {formatDate(entry.createdAt)}
                  </time>
                  {entry.amount ? (
                    <p className="font-mono text-sm font-medium text-foreground">
                      {entry.amount}
                    </p>
                  ) : null}
                </div>
              </article>
            </Plate>
          ))}
        </ol>
      )}
    </main>
  );
}

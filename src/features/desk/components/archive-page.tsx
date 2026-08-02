import { useMemo, useState } from "react";
import { useAuth } from "@clerk/tanstack-react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock3,
  PackageCheck,
  RefreshCw,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { EvidenceLedger, Plate, SectionKicker } from "@/components/morrow/bits";
import {
  RetroResearchCarousel,
  type RetroResearchItem,
} from "@/components/ui/retro-testimonial";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/morrow-api";
import { listArchive, repeatArchiveInspection } from "../api/client";
import type { ArchiveDossier } from "../api/types";

type ArchiveFilter = "all" | "verified" | "ordered" | "review";

const filters: Array<{ value: ArchiveFilter; label: string }> = [
  { value: "all", label: "All records" },
  { value: "verified", label: "Verified" },
  { value: "ordered", label: "Ordered" },
  { value: "review", label: "Needs review" },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function observedText(
  observation: ArchiveDossier["observation"],
  key: "brand" | "productName" | "variant" | "category",
): string | null {
  const value = observation?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function productTitle(dossier: ArchiveDossier): string {
  return (
    [
      dossier.product.brand ?? observedText(dossier.observation, "brand"),
      dossier.product.name ?? observedText(dossier.observation, "productName"),
    ]
      .filter(Boolean)
      .join(" ") || "Object inspection"
  );
}

function verificationState(dossier: ArchiveDossier): {
  label: string;
  tone: RetroResearchItem["statusTone"];
} {
  if (
    dossier.verification.classification === "exact_verified" ||
    dossier.verification.userConfirmed
  ) {
    return { label: "Exact record", tone: "verified" };
  }
  if (dossier.verification.classification === "similar") {
    return { label: "Alternative", tone: "similar" };
  }
  if (dossier.errorCode || dossier.status === "CHECKOUT_FAILED") {
    return { label: "Stopped", tone: "stopped" };
  }
  return { label: "Needs review", tone: "uncertain" };
}

function dossierSummary(dossier: ArchiveDossier): string {
  if (dossier.latestOrder) {
    return `${dossier.latestOrder.merchantName} recorded ${dossier.latestOrder.status.toLowerCase().replaceAll("_", " ")} at ${formatMoney(dossier.latestOrder.totalMinor, dossier.latestOrder.currency)}.`;
  }
  if (dossier.errorMessage) return dossier.errorMessage;
  if (dossier.verification.classification === "exact_verified") {
    return `${dossier.verification.matchedEvidence.length || dossier.verification.evidenceCount} identity signals were retained for this exact product record.`;
  }
  if (dossier.verification.userConfirmed) {
    return "The product was explicitly confirmed and can be checked against a fresh merchant dispatch.";
  }
  return "The observation is retained, but it cannot start another purchase without more evidence or confirmation.";
}

function dossierFacts(dossier: ArchiveDossier) {
  const size = dossier.product.size
    ? `${dossier.product.size.value} ${dossier.product.size.unit}`
    : "Not recorded";
  const identifier =
    dossier.product.gtin ??
    dossier.product.modelNumber ??
    dossier.product.partNumber ??
    "No identifier";
  return [
    { label: "Variant", value: dossier.product.variant ?? "Standard" },
    { label: "Size", value: size },
    {
      label: "Identity",
      value:
        dossier.verification.identityScore === null
          ? "Unscored"
          : `${Math.round(dossier.verification.identityScore * 100)}%`,
    },
    { label: "Identifier", value: identifier },
  ];
}

function toResearchItem(dossier: ArchiveDossier): RetroResearchItem {
  const state = verificationState(dossier);
  return {
    id: dossier.scanId,
    catalogueNumber: `INS–${dossier.scanId.slice(0, 8).toUpperCase()}`,
    title: productTitle(dossier),
    subtitle:
      dossier.product.variant ??
      observedText(dossier.observation, "variant") ??
      dossier.product.category ??
      observedText(dossier.observation, "category") ??
      "Object record",
    summary: dossierSummary(dossier),
    imageUrl: dossier.product.imageUrl,
    statusLabel: state.label,
    statusTone: state.tone,
    inspectedAt: formatDate(dossier.createdAt),
    sourceLabel:
      dossier.product.sourceMerchantDomain ??
      (dossier.product.sourceProvider
        ? dossier.product.sourceProvider.replaceAll("_", " ")
        : null),
    facts: dossierFacts(dossier),
  };
}

function filterDossier(
  dossier: ArchiveDossier,
  filter: ArchiveFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "verified") {
    return (
      dossier.verification.classification === "exact_verified" ||
      dossier.verification.userConfirmed
    );
  }
  if (filter === "ordered") return dossier.latestOrder !== null;
  return (
    dossier.verification.classification !== "exact_verified" &&
    !dossier.verification.userConfirmed
  );
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function DossierDetail({
  dossier,
  pending,
  onRepeat,
}: {
  dossier: ArchiveDossier;
  pending: boolean;
  onRepeat: (action: "reorder" | "prepare_approval") => void;
}) {
  const evidence = [
    ...dossier.verification.matchedEvidence.map((match) => ({
      label: titleCase(match.field ?? "identity evidence"),
      status: "confirmed" as const,
    })),
    ...dossier.verification.evidenceTypes
      .filter(
        (type) =>
          !dossier.verification.matchedEvidence.some(
            (match) => match.field === type,
          ),
      )
      .slice(0, 4)
      .map((type) => ({
        label: titleCase(type),
        status: "confirmed" as const,
      })),
    ...dossier.verification.contradictions.slice(0, 2).map((conflict) => ({
      label: `${titleCase(conflict.field ?? "identity")} contradiction`,
      status: "failed" as const,
    })),
  ];

  return (
    <div className="space-y-6">
      <section aria-labelledby={`${dossier.scanId}-evidence`}>
        <SectionKicker index="01">Identity evidence</SectionKicker>
        <h3
          id={`${dossier.scanId}-evidence`}
          className="mt-2 font-display text-xl"
        >
          What Morrow retained
        </h3>
        {evidence.length ? (
          <EvidenceLedger items={evidence} className="mt-3" />
        ) : (
          <p className="mt-3 border-y border-border py-3 text-sm text-muted-foreground">
            No exact identity signal was retained for this inspection.
          </p>
        )}
      </section>

      <section aria-labelledby={`${dossier.scanId}-trail`}>
        <SectionKicker index="02">Record trail</SectionKicker>
        <h3
          id={`${dossier.scanId}-trail`}
          className="mt-2 font-display text-xl"
        >
          Inspection to dispatch
        </h3>
        <ol className="mt-3 border-y border-border">
          <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 border-b border-border py-3">
            <ScanLine className="mt-0.5 h-4 w-4 text-brass" aria-hidden />
            <div>
              <p className="text-sm font-medium">Inspection recorded</p>
              <p className="mono-caps mt-1 text-muted-foreground">
                {formatDate(dossier.createdAt)} · {titleCase(dossier.status)}
              </p>
            </div>
          </li>
          <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 border-b border-border py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-brass" aria-hidden />
            <div>
              <p className="text-sm font-medium">Bounded request</p>
              <p className="mono-caps mt-1 text-muted-foreground">
                {dossier.latestRequest
                  ? `${titleCase(dossier.latestRequest.status)} · ${formatMoney(dossier.latestRequest.maxAuthorizedAmountMinor, dossier.latestRequest.currency)}`
                  : "Not prepared"}
              </p>
            </div>
          </li>
          <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 py-3">
            <PackageCheck className="mt-0.5 h-4 w-4 text-brass" aria-hidden />
            <div>
              <p className="text-sm font-medium">Merchant dispatch</p>
              <p className="mono-caps mt-1 text-muted-foreground">
                {dossier.latestOrder
                  ? `${dossier.latestOrder.merchantName} · ${titleCase(dossier.latestOrder.status)}`
                  : "No merchant order recorded"}
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section
        className="border border-brass/50 bg-secondary/35 p-4"
        aria-labelledby={`${dossier.scanId}-repeat`}
      >
        <SectionKicker index="03">Repeat authority</SectionKicker>
        <h3
          id={`${dossier.scanId}-repeat`}
          className="mt-2 font-display text-xl"
        >
          Refresh before approving
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Morrow reuses the confirmed identity, then checks current stock,
          variant, merchant, and total. Prava requests a one-purchase mandate
          only after you choose that current dispatch and approve with a
          passkey.
        </p>
        {dossier.repeatEligibility.allowed ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button
              className="h-11"
              disabled={pending}
              onClick={() => onRepeat("reorder")}
            >
              <RefreshCw
                className={cn("h-4 w-4", pending && "animate-spin")}
                aria-hidden
              />
              {dossier.latestOrder ? "Order again" : "Find current dispatch"}
            </Button>
            <Button
              variant="outline"
              className="h-11"
              disabled={pending}
              onClick={() => onRepeat("prepare_approval")}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Prepare approval
            </Button>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-xs leading-relaxed text-postal">
              {dossier.repeatEligibility.reason}
            </p>
            <Button variant="outline" className="mt-3 h-11 w-full" asChild>
              <Link to="/scan">
                <ScanLine className="h-4 w-4" aria-hidden />
                Inspect this object again
              </Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

export function ArchivePage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ArchiveFilter>("all");
  const query = useQuery({
    queryKey: ["morrow-archive"],
    enabled: isLoaded && isSignedIn,
    staleTime: 15_000,
    queryFn: async () => {
      const accessToken = await getToken();
      if (!accessToken) {
        throw new ApiError({
          code: "AUTH_REQUIRED",
          message: "Your private archive could not be opened. Sign in again.",
        });
      }
      return listArchive(accessToken);
    },
  });
  const repeat = useMutation({
    mutationFn: async (input: {
      dossier: ArchiveDossier;
      action: "reorder" | "prepare_approval";
    }) => {
      const accessToken = await getToken();
      if (!accessToken) {
        throw new ApiError({
          code: "AUTH_REQUIRED",
          message: "Your account session has ended. Sign in again.",
        });
      }
      const suggestedLimit =
        input.dossier.latestRequest?.maxAuthorizedAmountMinor ??
        input.dossier.maxBudgetMinor ??
        input.dossier.latestOrder?.totalMinor;
      const currency =
        input.dossier.latestRequest?.currency ??
        input.dossier.currency ??
        input.dossier.latestOrder?.currency;
      return repeatArchiveInspection(accessToken, {
        scanId: input.dossier.scanId,
        action: input.action,
        quantity: input.dossier.latestOrder?.quantity ?? input.dossier.quantity,
        ...(suggestedLimit === undefined || suggestedLimit === null
          ? {}
          : { maxBudgetMinor: suggestedLimit }),
        ...(currency ? { currency } : {}),
      });
    },
    onSuccess: (result) => {
      void navigate({
        to: "/scan",
        search: { resumeScanId: result.scanId },
      });
    },
  });

  const dossiers = useMemo(() => query.data ?? [], [query.data]);
  const filtered = useMemo(
    () => dossiers.filter((dossier) => filterDossier(dossier, filter)),
    [dossiers, filter],
  );
  const items = useMemo(() => filtered.map(toResearchItem), [filtered]);
  const dossierById = useMemo(
    () => new Map(dossiers.map((dossier) => [dossier.scanId, dossier])),
    [dossiers],
  );
  const verifiedCount = dossiers.filter(
    (dossier) =>
      dossier.verification.classification === "exact_verified" ||
      dossier.verification.userConfirmed,
  ).length;
  const orderCount = dossiers.filter((dossier) => dossier.latestOrder).length;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-5">
      <section
        className="border-b border-border pb-5"
        aria-labelledby="archive-title"
      >
        <p className="label-caps text-postal">Inspection archive</p>
        <div className="mt-2 flex items-start gap-3">
          <Archive className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden />
          <div>
            <h1
              id="archive-title"
              className="font-display text-3xl leading-tight"
            >
              Researched objects, filed with their evidence.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Reopen a dossier, review what matched, or refresh a confirmed
              product against today&apos;s merchant catalogues.
            </p>
          </div>
        </div>
      </section>

      {query.isPending ? (
        <Plate
          className="mt-5 flex min-h-56 items-center justify-center p-6"
          as="section"
        >
          <div className="text-center" role="status">
            <Clock3
              className="mx-auto h-6 w-6 animate-pulse text-brass"
              aria-hidden
            />
            <p className="mono-caps mt-3 text-muted-foreground">
              Drawing archive cards
            </p>
          </div>
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
                The archive stayed closed.
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
      ) : dossiers.length === 0 ? (
        <Plate className="mt-5 p-7 text-center" as="section">
          <Archive className="mx-auto h-8 w-8 text-brass" aria-hidden />
          <h2 className="mt-3 font-display text-2xl">The archive is empty.</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Show Morrow an object to create the first research record.
          </p>
          <Button className="mt-5 h-11" asChild>
            <Link to="/scan">Open Morrow</Link>
          </Button>
        </Plate>
      ) : (
        <>
          <dl className="mt-5 grid grid-cols-3 gap-px border border-border bg-border">
            {[
              { label: "Records", value: dossiers.length, icon: Archive },
              { label: "Verified", value: verifiedCount, icon: CheckCircle2 },
              { label: "Orders", value: orderCount, icon: PackageCheck },
            ].map((stat) => (
              <div key={stat.label} className="bg-card px-3 py-4 text-center">
                <stat.icon className="mx-auto h-4 w-4 text-brass" aria-hidden />
                <dd className="mt-1 font-display text-2xl">{stat.value}</dd>
                <dt className="mono-caps text-muted-foreground">
                  {stat.label}
                </dt>
              </div>
            ))}
          </dl>

          <div
            className="mt-5 overflow-x-auto pb-1"
            aria-label="Filter archive"
          >
            <div className="flex min-w-max gap-2">
              {filters.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  aria-pressed={filter === option.value}
                  className={cn(
                    "min-h-11 border px-4 text-xs font-semibold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    filter === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-brass hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {repeat.isError ? (
            <div
              className="mt-4 border border-postal/50 bg-postal/5 p-3 text-sm text-postal"
              role="alert"
            >
              {repeat.error instanceof Error
                ? repeat.error.message
                : "The repeat request could not be prepared."}
            </div>
          ) : null}

          {items.length ? (
            <RetroResearchCarousel
              items={items}
              className="mt-4"
              renderExpanded={(item) => {
                const dossier = dossierById.get(item.id);
                return dossier ? (
                  <DossierDetail
                    dossier={dossier}
                    pending={
                      repeat.isPending &&
                      repeat.variables?.dossier.scanId === dossier.scanId
                    }
                    onRepeat={(action) => repeat.mutate({ dossier, action })}
                  />
                ) : null;
              }}
            />
          ) : (
            <Plate className="mt-4 p-6 text-center" as="section">
              <h2 className="font-display text-xl">
                No records in this drawer.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose another filter to see the rest of the archive.
              </p>
            </Plate>
          )}
        </>
      )}
    </main>
  );
}

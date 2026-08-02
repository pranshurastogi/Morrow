import type { Candidate, ScanRecord } from "../api/types";

export interface ExternalCatalogLink {
  id: "amazon-in" | "shopping-search";
  label: string;
  href: string;
}

function compactPhrases(
  values: Array<string | number | null | undefined>,
): string[] {
  const selected: string[] = [];
  for (const value of values) {
    const phrase = String(value ?? "").trim();
    if (!phrase) continue;
    const normalized = phrase.toLowerCase();
    if (selected.some((known) => known.toLowerCase().includes(normalized))) {
      continue;
    }
    selected.push(phrase);
  }
  return selected;
}

export function buildExternalCatalogQuery(input: {
  scan: ScanRecord;
  candidate?: Candidate | null;
}): string {
  const { candidate, scan } = input;
  const observation = scan.observation;
  const candidateQuery = candidate
    ? [
        candidate.brand,
        candidate.name,
        candidate.model_number ?? candidate.mpn,
        candidate.variant,
        candidate.size_value
          ? `${candidate.size_value} ${candidate.size_unit}`
          : null,
        candidate.gtin,
      ]
    : [];
  const observationQuery = observation
    ? [
        observation.brand,
        observation.productName,
        observation.modelNumber ?? observation.partNumber,
        observation.variant,
        observation.size
          ? `${observation.size.value} ${observation.size.unit}`
          : null,
        ...(observation.visualSearchTerms ?? []).slice(0, 2),
        observation.subcategory ?? observation.category,
      ]
    : [];
  return compactPhrases(
    candidateQuery.length > 0 ? candidateQuery : observationQuery,
  )
    .join(" ")
    .slice(0, 240);
}

export function buildExternalCatalogLinks(
  query: string,
): ExternalCatalogLink[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const amazon = new URL("https://www.amazon.in/s");
  amazon.searchParams.set("k", trimmed);
  const shopping = new URL("https://www.google.com/search");
  shopping.searchParams.set("tbm", "shop");
  shopping.searchParams.set("q", trimmed);
  return [
    {
      id: "amazon-in",
      label: "Search Amazon India",
      href: amazon.toString(),
    },
    {
      id: "shopping-search",
      label: "Search wider catalogues",
      href: shopping.toString(),
    },
  ];
}

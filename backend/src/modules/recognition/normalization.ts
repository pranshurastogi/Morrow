import type { NormalizedSize } from "../../domain/product-observation";

export function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[™®©]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeIdentifier(value: string): string {
  return value
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^(MODEL(?:NO|NUMBER)?|PART(?:NO|NUMBER)?|MPN)/, "");
}

export function normalizeBarcode(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  return digits;
}

const UNIT_TO_BASE: Record<
  NormalizedSize["unit"],
  { dimension: string; factor: number }
> = {
  ml: { dimension: "volume", factor: 1 },
  l: { dimension: "volume", factor: 1_000 },
  fl_oz: { dimension: "volume", factor: 29.5735295625 },
  g: { dimension: "mass", factor: 1 },
  kg: { dimension: "mass", factor: 1_000 },
  oz: { dimension: "mass", factor: 28.349523125 },
  mm: { dimension: "length", factor: 1 },
  cm: { dimension: "length", factor: 10 },
  m: { dimension: "length", factor: 1_000 },
  in: { dimension: "length", factor: 25.4 },
};

export function sizesEquivalent(
  a: NormalizedSize,
  b: NormalizedSize,
  tolerance = 0.025,
): boolean {
  const left = UNIT_TO_BASE[a.unit];
  const right = UNIT_TO_BASE[b.unit];
  if (left.dimension !== right.dimension) return false;
  const leftValue = a.value * left.factor;
  const rightValue = b.value * right.factor;
  const scale = Math.max(leftValue, rightValue, 1);
  return Math.abs(leftValue - rightValue) / scale <= tolerance;
}

export function tokenize(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter((token) => token.length > 1),
  );
}

export function jaccardSimilarity(left: string, right: string): number {
  const a = tokenize(left);
  const b = tokenize(right);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

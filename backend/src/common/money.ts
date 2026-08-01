import { MorrowError } from "./errors";

export function decimalToMinorUnits(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new MorrowError({
      code: "INVALID_REQUEST",
      message: "Invalid money amount",
    });
  }
  const [whole = "0", fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result)) {
    throw new MorrowError({
      code: "INVALID_REQUEST",
      message: "Money amount is too large",
    });
  }
  return result;
}

export function minorUnitsToDecimal(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new MorrowError({
      code: "INVALID_REQUEST",
      message: "Invalid minor-unit amount",
    });
  }
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}

export function validateFinalTotal(input: {
  quotedTotalMinor: number;
  finalTotalMinor: number;
  authorizedMaximumMinor: number;
}): { allowed: true } {
  if (input.finalTotalMinor > input.authorizedMaximumMinor) {
    throw new MorrowError({
      code: "FINAL_TOTAL_EXCEEDS_LIMIT",
      message: "The final total exceeds the approved maximum",
      statusCode: 409,
      details: input,
    });
  }
  return { allowed: true };
}

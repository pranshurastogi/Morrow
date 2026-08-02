import type { Sql } from "postgres";
import { MorrowError } from "../../common/errors";
import { getDatabase } from "../../infrastructure/database/client";
import { databaseJson } from "../../infrastructure/database/json";

type JsonRecord = Record<string, unknown>;

export interface ArchiveDossier {
  scanId: string;
  status: string;
  mode: "exact" | "similar_allowed";
  quantity: number;
  maxBudgetMinor: number | null;
  currency: string | null;
  observation: JsonRecord | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string | null;
    category: string | null;
    brand: string | null;
    name: string | null;
    variant: string | null;
    size: { value: number; unit: string } | null;
    gtin: string | null;
    modelNumber: string | null;
    partNumber: string | null;
    imageUrl: string | null;
    sourceProvider: string | null;
    sourceMerchantDomain: string | null;
  };
  verification: {
    classification: string | null;
    identityScore: number | null;
    matchedEvidence: JsonRecord[];
    contradictions: JsonRecord[];
    evidenceTypes: string[];
    evidenceCount: number;
    userConfirmed: boolean;
  };
  latestRequest: {
    id: string;
    status: string;
    maxAuthorizedAmountMinor: number;
    currency: string;
    expiresAt: string;
    createdAt: string;
  } | null;
  latestOrder: {
    id: string;
    merchantOrderId: string | null;
    merchantName: string;
    status: string;
    quantity: number;
    totalMinor: number;
    currency: string;
    createdAt: string;
  } | null;
  repeatEligibility: {
    allowed: boolean;
    reason: string;
  };
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function jsonArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? (value as JsonRecord[]) : [];
}

export async function listArchiveDossiers(
  userId: string,
  sql: Sql = getDatabase(),
): Promise<ArchiveDossier[]> {
  const scans = await sql`
    select s.*, cp.id as product_id, cp.category as product_category,
      cp.brand as product_brand, cp.name as product_name,
      cp.variant as product_variant, cp.size_value, cp.size_unit, cp.gtin,
      cp.model_number, cp.mpn, cp.source_provider,
      cp.source_merchant_domain, candidate.classification,
      candidate.identity_score, candidate.matched_evidence,
      candidate.contradictions,
      exists (
        select 1 from user_product_confirmations confirmation
        where confirmation.user_id = s.user_id
          and confirmation.scan_id = s.id
          and confirmation.product_id = cp.id
      ) as user_confirmed,
      (
        select image.image_url from product_images image
        where image.product_id = cp.id
        order by case when image.image_type = 'primary' then 0 else 1 end,
          image.created_at desc
        limit 1
      ) as image_url
    from scans s
    left join lateral (
      select sc.product_id, sc.classification, sc.identity_score,
        sc.matched_evidence, sc.contradictions
      from scan_candidates sc
      where sc.scan_id = s.id
      order by case when sc.product_id = s.selected_product_id then 0 else 1 end,
        sc.rank
      limit 1
    ) candidate on true
    left join canonical_products cp
      on cp.id = coalesce(s.selected_product_id, candidate.product_id)
    where s.user_id = ${userId}
    order by s.created_at desc
    limit 100
  `;

  if (scans.length === 0) return [];
  const scanIds = scans.map((row) => String(row.id));
  const [evidenceRows, requestRows, orderRows] = await Promise.all([
    sql`
      select scan_id, count(*)::integer as evidence_count,
        array_agg(distinct evidence_type order by evidence_type) as evidence_types
      from scan_evidence
      where scan_id in ${sql(scanIds)}
      group by scan_id
    `,
    sql`
      select distinct on (scan_id) scan_id, id, status,
        max_authorized_amount_minor, currency, expires_at, created_at
      from purchase_intents
      where user_id = ${userId} and scan_id in ${sql(scanIds)}
      order by scan_id, created_at desc
    `,
    sql`
      select distinct on (intent.scan_id) intent.scan_id, orders.id,
        orders.merchant_order_id, orders.merchant_name, orders.status,
        orders.quantity, orders.total_minor, orders.currency, orders.created_at
      from orders
      join purchase_intents intent on intent.id = orders.purchase_intent_id
      where orders.user_id = ${userId} and intent.scan_id in ${sql(scanIds)}
      order by intent.scan_id, orders.created_at desc
    `,
  ]);

  const evidenceByScan = new Map(
    evidenceRows.map((row) => [String(row.scan_id), row]),
  );
  const requestByScan = new Map(
    requestRows.map((row) => [String(row.scan_id), row]),
  );
  const orderByScan = new Map(
    orderRows.map((row) => [String(row.scan_id), row]),
  );

  return scans.map((row) => {
    const scanId = String(row.id);
    const evidence = evidenceByScan.get(scanId);
    const request = requestByScan.get(scanId);
    const order = orderByScan.get(scanId);
    const productId = nullableString(row.product_id);
    const userConfirmed = Boolean(row.user_confirmed);
    const classification = nullableString(row.classification);
    const repeatAllowed =
      productId !== null &&
      (classification === "exact_verified" || userConfirmed);

    return {
      scanId,
      status: String(row.status),
      mode: row.mode as ArchiveDossier["mode"],
      quantity: Number(row.quantity),
      maxBudgetMinor: nullableNumber(row.max_budget_minor),
      currency: nullableString(row.currency)?.trim() ?? null,
      observation: (row.observation as JsonRecord | null) ?? null,
      errorCode: nullableString(row.error_code),
      errorMessage: nullableString(row.error_message),
      createdAt: new Date(String(row.created_at)).toISOString(),
      updatedAt: new Date(String(row.updated_at)).toISOString(),
      product: {
        id: productId,
        category: nullableString(row.product_category),
        brand: nullableString(row.product_brand),
        name: nullableString(row.product_name),
        variant: nullableString(row.product_variant),
        size:
          row.size_value === null || row.size_unit === null
            ? null
            : { value: Number(row.size_value), unit: String(row.size_unit) },
        gtin: nullableString(row.gtin),
        modelNumber: nullableString(row.model_number),
        partNumber: nullableString(row.mpn),
        imageUrl: nullableString(row.image_url),
        sourceProvider: nullableString(row.source_provider),
        sourceMerchantDomain: nullableString(row.source_merchant_domain),
      },
      verification: {
        classification,
        identityScore: nullableNumber(row.identity_score),
        matchedEvidence: jsonArray(row.matched_evidence),
        contradictions: jsonArray(row.contradictions),
        evidenceTypes: Array.isArray(evidence?.evidence_types)
          ? evidence.evidence_types.map(String)
          : [],
        evidenceCount: Number(evidence?.evidence_count ?? 0),
        userConfirmed,
      },
      latestRequest: request
        ? {
            id: String(request.id),
            status: String(request.status),
            maxAuthorizedAmountMinor: Number(
              request.max_authorized_amount_minor,
            ),
            currency: String(request.currency).trim(),
            expiresAt: new Date(String(request.expires_at)).toISOString(),
            createdAt: new Date(String(request.created_at)).toISOString(),
          }
        : null,
      latestOrder: order
        ? {
            id: String(order.id),
            merchantOrderId: nullableString(order.merchant_order_id),
            merchantName: String(order.merchant_name),
            status: String(order.status),
            quantity: Number(order.quantity),
            totalMinor: Number(order.total_minor),
            currency: String(order.currency).trim(),
            createdAt: new Date(String(order.created_at)).toISOString(),
          }
        : null,
      repeatEligibility: {
        allowed: repeatAllowed,
        reason: repeatAllowed
          ? "A prior exact match or explicit confirmation can be refreshed against current merchant catalogues."
          : "Repeat purchase needs a previously exact or explicitly confirmed product.",
      },
    };
  });
}

export async function createArchiveRepeat(
  input: {
    sourceScanId: string;
    userId: string;
    action: "reorder" | "prepare_approval";
    quantity: number;
    maxBudgetMinor?: number;
    currency?: string;
  },
  sql: Sql = getDatabase(),
): Promise<{ scanId: string; status: "EXACT_VERIFIED"; version: number }> {
  return sql.begin(async (transaction) => {
    const [source] = await transaction`
      select s.*, candidate.classification, candidate.retrieval_score,
        candidate.identifier_score, candidate.text_score, candidate.image_score,
        candidate.history_score, candidate.identity_score,
        candidate.purchase_score, candidate.matched_evidence,
        candidate.contradictions,
        exists (
          select 1 from user_product_confirmations confirmation
          where confirmation.user_id = s.user_id
            and confirmation.scan_id = s.id
            and confirmation.product_id = s.selected_product_id
        ) as user_confirmed
      from scans s
      left join scan_candidates candidate
        on candidate.scan_id = s.id
        and candidate.product_id = s.selected_product_id
      where s.id = ${input.sourceScanId} and s.user_id = ${input.userId}
      for update of s
    `;
    if (!source) {
      throw new MorrowError({
        code: "NOT_FOUND",
        message: "Archived inspection not found",
        statusCode: 404,
      });
    }
    if (
      source.selected_product_id === null ||
      (source.classification !== "exact_verified" && !source.user_confirmed)
    ) {
      throw new MorrowError({
        code: "MORE_EVIDENCE_REQUIRED",
        message:
          "This object must be inspected or explicitly confirmed before a repeat purchase can be prepared.",
        statusCode: 409,
      });
    }

    const currency = (
      input.currency ??
      (source.currency === null ? "INR" : String(source.currency))
    )
      .trim()
      .toUpperCase();
    const maxBudgetMinor =
      input.maxBudgetMinor ??
      (source.max_budget_minor === null
        ? null
        : Number(source.max_budget_minor));
    const [repeat] = await transaction`
      insert into scans (
        user_id, status, mode, quantity, max_budget_minor, currency,
        country_code, observation, selected_product_id, source_scan_id,
        initiation_source
      ) values (
        ${input.userId}, 'EXACT_VERIFIED', 'exact', ${input.quantity},
        ${maxBudgetMinor}, ${currency}, ${source.country_code ?? "IN"},
        ${transaction.json(databaseJson((source.observation as JsonRecord | null) ?? {}))},
        ${source.selected_product_id}, ${input.sourceScanId}, 'archive_repeat'
      ) returning id, status, version
    `;
    if (!repeat) throw new Error("Repeat inspection was not created");

    if (source.classification) {
      await transaction`
        insert into scan_candidates (
          scan_id, product_id, retrieval_score, identifier_score, text_score,
          image_score, history_score, identity_score, purchase_score,
          classification, matched_evidence, contradictions, rank
        ) values (
          ${repeat.id}, ${source.selected_product_id},
          ${source.retrieval_score ?? 1}, ${source.identifier_score ?? 0},
          ${source.text_score ?? 0}, ${source.image_score ?? 0}, 1,
          ${source.identity_score ?? 0.8}, ${source.purchase_score ?? 0.8},
          ${source.classification},
          ${transaction.json(databaseJson(jsonArray(source.matched_evidence)))},
          ${transaction.json(databaseJson(jsonArray(source.contradictions)))}, 1
        )
      `;
    } else {
      await transaction`
        insert into scan_candidates (
          scan_id, product_id, retrieval_score, history_score, identity_score,
          purchase_score, classification, rank
        ) values (
          ${repeat.id}, ${source.selected_product_id}, 1, 1, 0.8, 0.8,
          'likely_exact', 1
        )
      `;
    }
    if (source.user_confirmed) {
      await transaction`
        insert into user_product_confirmations (
          user_id, product_id, scan_id, confirmation_type
        ) values (
          ${input.userId}, ${source.selected_product_id}, ${repeat.id},
          'archive_repeat'
        ) on conflict do nothing
      `;
    }
    await transaction`
      insert into audit_events (
        user_id, entity_type, entity_id, event_type, actor_type, actor_id, payload
      ) values (
        ${input.userId}, 'scan', ${repeat.id}, 'ARCHIVE_REPEAT_PREPARED',
        'user', ${input.userId}, ${transaction.json(
          databaseJson({
            sourceScanId: input.sourceScanId,
            action: input.action,
            productId: String(source.selected_product_id),
            quantity: input.quantity,
            maxBudgetMinor,
            currency,
          }),
        )}
      )
    `;
    return {
      scanId: String(repeat.id),
      status: "EXACT_VERIFIED" as const,
      version: Number(repeat.version),
    };
  });
}

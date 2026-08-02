# Recognition evaluation

Run the deterministic identity policy against a frozen manifest:

```sh
bun run eval:recognition ./private-evals/recognition-v1.json
```

The manifest is intentionally not committed because real buyer photographs and
product annotations may require consent and controlled access. Its shape is:

```json
{
  "version": "recognition-v1",
  "gates": {
    "minExactPrecision": 0.98,
    "minRecallAt5": 0.9,
    "minSelectableCoverage": 0.7,
    "maxNoResultRate": 0.05
  },
  "cases": [
    {
      "id": "dot-key-red-romance-front",
      "observation": {},
      "candidates": [],
      "expectedStatus": "EXACT_VERIFIED",
      "expectedProductId": "catalogue-product-id"
    }
  ]
}
```

`observation` follows `ProductObservation`; candidates follow
`CanonicalProductCandidate`. Export sanitized, consented model outputs and
catalogue records into this format. Keep the final test split product-family
disjoint and never tune thresholds against it.

The report separates retrieval from verification. `recallAt1/3/5/10` measures
whether the expected SKU reached the verifier; `exactPrecision` measures the
dangerous claim boundary; `selectableCoverage` measures how often the user sees
an actionable exact, likely, or explicitly labelled alternative;
`liveSourceBackedCoverage` measures how often at least one selectable candidate
has a real UCP variant that may continue to offer comparison and Prava. Optional
gates make the command exit non-zero when a release regresses.

Build the private suite around commercially expensive hard negatives rather
than random negatives: adjacent sizes, shades, pack counts, formulations,
regional electrical variants, connectors, left/right parts, old packaging, and
near-identical unofficial listings. Include generic objects without readable
text, cluttered scenes, partial crops, glare, blur, and multilingual labels.

When benchmarking an image encoder, freeze this manifest and compare the same
catalogue snapshot. Report retrieval recall, p50/p95 embedding latency, index
size, and cost at a fixed deterministic exact-precision threshold. Do not select
a model from a public leaderboard alone.

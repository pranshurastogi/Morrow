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

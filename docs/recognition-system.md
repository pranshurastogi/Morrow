# Recognition system: accuracy, latency, and evaluation

Morrow treats product recognition as a retrieval-and-verification system, not
as a single image prompt. The commercial error costs are asymmetric: an
abstention costs another photograph; a false exact match can create the wrong
order. Optimisation therefore targets **verified-order precision first**, then
coverage, latency, and cost.

## Why this architecture

Instance-level product search works better when the object is first isolated
from scene clutter and a fast retriever is followed by a more precise reranker.
This is consistent with regional detect-to-retrieve systems
([CVPR 2019](https://openaccess.thecvf.com/content_CVPR_2019/html/Teichmann_Detect-To-Retrieve_Efficient_Regional_Aggregation_for_Image_Search_CVPR_2019_paper.html))
and large product-retrieval work such as
[Product1M](https://openaccess.thecvf.com/content/ICCV2021/html/Zhan_Product1M_Towards_Weakly_Supervised_Instance-Level_Product_Retrieval_via_Cross-Modal_Pretraining_ICCV_2021_paper.html).
Recent visual encoders such as
[DINOv2](https://arxiv.org/abs/2304.07193) and
[SigLIP 2](https://arxiv.org/abs/2502.14786) provide strong retrieval features;
SigLIP 2 also reports improved localisation and native-aspect-ratio support.
[DINOv3](https://arxiv.org/abs/2508.10104) extends self-supervised dense visual
features, while [MobileCLIP2](https://arxiv.org/abs/2508.20691) targets much
lower-latency image-text inference. They are appropriate candidate first-stage
indexes once Morrow has enough catalogue imagery and a managed inference
service to justify their operating cost; none is assumed superior for retail
SKU matching before Morrow's own hard-negative benchmark.

Generative multimodal models are retained as a bounded reranker because exact
product identity is compositional: a package can look right while the shade,
size, formulation, connector, or model marking is wrong. Current retrieval
research likewise uses a fast first rank followed by fine-grained reranking
([LOCORE, CVPR 2025](https://openaccess.thecvf.com/content/CVPR2025/html/Xiao_LOCORE_Image_Re-ranking_with_Long-Context_Sequence_Modeling_CVPR_2025_paper.html)).
The PinPoint benchmark further shows why explicit hard negatives and
multi-image tests matter even for strong composed-image retrieval systems
([CVPR 2026](https://openaccess.thecvf.com/content/CVPR2026/html/Mahadev_PinPoint_Evaluation_of_Composed_Image_Retrieval_with_Explicit_Negatives_Multi-Image_CVPR_2026_paper.html)).

## Current production path

1. **Prepare bounded views.** Orientation and metadata are normalised once.
   Morrow keeps a full frame, an attention-centred object view, an
   entropy-centred label view, a contrast-normalised OCR view, and a thumbnail.
2. **Extract independent evidence.** Barcode decoding and OCR run in parallel.
   The vision observer sees the full view at low cost plus bounded object and
   label views at higher detail. The OpenAI vision guide recommends explicit
   original detail for OCR and small spatial evidence, while resizing inputs to
   control cost and latency
   ([official guide](https://developers.openai.com/api/docs/guides/images-vision#choose-an-image-detail-level)).
3. **Retrieve broadly.** Exact identifiers, strict full text, broad lexical
   recall, text embeddings, prior confirmations, Shopify Global Catalog, and
   relevant official storefronts produce a bounded union. Storefront discovery
   now sends independent identifier, exact, relaxed, and short visual-language
   queries instead of one overloaded sentence. Local channels are combined with
   weighted reciprocal-rank fusion, an established rank-combination method
   that rewards agreement without requiring incomparable score scales
   ([Cormack, Clarke, and Buettcher](https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf)).
4. **Rerank narrowly.** At most nine imaged finalists are compared in parallel
   batches of three. The model emits categorical observable states—match,
   mismatch, or unknown—for brand, line, package form, label layout, colourway,
   variant, and size. Unknown never becomes positive evidence.
5. **Re-perceive only uncertainty.** When the top visual scores are plausible
   but close, the best two receive one higher-quality comparison pass. This is
   an adaptive-compute version of visual re-perception rather than paying the
   highest model cost on every scan; recent work reports gains from revisiting
   zoomed/aligned regions specifically under uncertainty
   ([EVRI, CVPR 2026](https://openaccess.thecvf.com/content/CVPR2026F/html/Liufu_Entropy-Based_Visual_Re-perception_Inference_for_Multimodal_Models_CVPRF_2026_paper.html)).
6. **Decide deterministically.** Policy code assigns weights, hard-rejects
   identifier/size/variant contradictions, applies candidate margins, and
   abstains when evidence is insufficient. A model's prose or self-reported
   confidence never authorises a purchase.

## Useful-result ladder

The interface should not collapse a recognised object into a blank failure,
but commerce evidence still determines what can be purchased:

1. A matching identifier with no fatal contradiction may be shown as exact.
2. A strongly corroborated record may be shown as likely, with user
   confirmation.
3. A visually close live UCP variant may be shown as a **connected
   alternative**. It is never promoted to exact; the buyer must choose it.
4. A source-backed chosen variant can be refreshed for inventory, currency,
   budget, and checkout before Prava is opened.
5. If no connected variant exists, Morrow retains the observed object family,
   nearest references, and external catalogue searches. Those links are useful
   research, not a Morrow offer and not eligible for Prava approval.

This ladder increases reference and selectable coverage while keeping the
payment boundary honest. The Shopify Storefront MCP exposes free-text catalogue
search and variant-level commerce data, but endpoint access and merchant
support vary; a directory row is not stock or checkout proof
([Shopify documentation](https://shopify.dev/docs/apps/build/storefront-mcp/servers/storefront)).

The observer and comparator use structured outputs, short outcome-first
contracts, stable prompts, and `store: false`. Prompt changes should be made
only against representative failures, following OpenAI's current guidance to
keep success criteria and evidence constraints while removing redundant
instructions
([official prompting guide](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6.md)).

## Evaluation set

Do not tune thresholds from successful demos. Maintain a versioned evaluation
manifest with product-family-disjoint train, calibration, and test partitions.
Each example should contain:

- one to four buyer photographs and their capture roles;
- canonical product and merchant-variant IDs;
- same-SKU positives across angle, lighting, crop, wear, and old packaging;
- hard negatives from the same family: different size, shade, formulation,
  pack count, region, voltage, connector, or compatibility;
- distractors with similar colours or package geometry;
- expected decision: exact, likely, similar, ambiguous, or more evidence;
- the smallest useful next capture when exact identity is not possible.

Every release should report:

| Measure                            | Purpose                                                         |
| ---------------------------------- | --------------------------------------------------------------- |
| Exact precision                    | How often an exact claim is truly the same sellable SKU         |
| Wrong-variant false-positive rate  | The most commercially dangerous visual error                    |
| Recall@10                          | Whether the retrieval stage gives verification a fair candidate |
| No-result rate                     | Fraction with no retained catalogue reference                   |
| Live source-backed coverage        | Fraction with an explicit candidate that can reach offer checks |
| Selective coverage                 | Fraction auto-verified at a fixed exact-precision target        |
| Additional-capture resolution rate | Whether abstention asks for useful evidence                     |
| p50 / p95 stage latency            | Preparation, observation, retrieval, reranking, merchants       |
| Cost per verified correct result   | Model and provider cost divided by successful verified outcomes |
| Cache hit rate                     | Whether repeated scans avoid unnecessary model work             |

Thresholds should be calibrated on the calibration split and frozen before the
test run. Slice results by category, merchant, image quality, language, device,
and presence of an identifier. Production corrections become new hard
negatives; they do not go directly into the held-out test set.

## Next measured upgrade

After collecting enough consented, correctly labelled product imagery, add a
dedicated image-embedding service behind an internal provider interface and
populate `product_images.image_embedding`. Evaluate DINOv2 and SigLIP 2 on the
same hard-negative set. Add DINOv3 for dense object-shape retrieval and
MobileCLIP2 for the latency-constrained lane. Use approximate nearest-neighbour
retrieval only for candidate generation and retain the deterministic verifier.
Do not ship this extra inference tier until it improves recall@10 or p95 latency
at the same exact-precision target.

The catalogue vectors should be precomputed and versioned by encoder, crop
policy, and input resolution. A scan should embed the prepared object crop once,
query a pgvector index, and fuse that rank with identifier, lexical, history,
and UCP ranks. Shadow-run a new encoder first; changing vector dimensions or
mixing model versions inside one index is not a safe in-place upgrade.

## Payment completion boundary

Prava remains downstream of identity and offer policy. Morrow creates a sandbox
session only after the buyer selects a source-backed variant and approves the
bounded merchant and amount. The browser receives Prava's `session_token` and
`iframe_url` verbatim; card entry and the real passkey ceremony stay inside
Prava's secure iframe. The backend polls the session and reports the merchant
outcome. Sandbox moves no real money but still uses real WebAuthn and a
15-minute session, so it is a transaction integration test rather than a mock
([Prava sandbox testing](https://docs.prava.space/api-reference/testing),
[collectPAN reference](https://docs.prava.space/sdk/cards/collect-pan)).

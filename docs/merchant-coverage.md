# Merchant discovery

Morrow uses Shopify's UCP-shaped MCP transport for commerce data and Prava's SDK/API for payment authority. These are separate boundaries: UCP discovers products and creates anonymous carts; Prava collects approval and issues a merchant- and amount-scoped credential.

The worker searches `https://catalog.shopify.com/api/ucp/mcp` first. The supplied 50 Indian storefront endpoints are registered as brand-targeted fallbacks, so Morrow does not fan one scan out to every merchant. Directory membership is discovery data, not proof of current stock, variant identity, or checkout compatibility.

For the initial India demo, prioritize merchants whose catalogues align with visually verifiable categories:

- skincare: The Derma Co, Clinikally, Dot & Key, Minimalist, Dr. Sheth's, Aqualogica, Pilgrim, Plum, Deconstruct;
- electronics: boAt, Noise, ACwO, Headphone Zone, Portronics;
- apparel and accessories: GIVA, Libas, The House of Rare, Mokobara, Campus Shoes.

A merchant becomes purchasable only after a current listing is imported with a source URL, timestamp, price, inventory state, external product and variant IDs, and a deterministic source-variant mapping. Morrow then refreshes a Cart MCP estimate. Directory membership alone never produces a verified offer.

Checkout completion is deliberately separate. Shopify `complete_checkout` requires an authenticated, trusted agent and payment-handler contract; Prava's public Browser Harness documentation does not publish an application endpoint. Configure `MERCHANT_CHECKOUT_EXECUTOR_URL` only with credentials supplied for a reviewed Prava Browser Harness wrapper or merchant adapter. Without it, sandbox approval is real but Morrow will not claim an order.

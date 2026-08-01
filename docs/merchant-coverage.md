# Merchant discovery

The merchant list supplied for the hackathon is discovery data, not proof of current stock, variant identity, or checkout compatibility. Several endpoints are MCP-shaped; Morrow does not call them because this build uses Prava SDK/API rather than MCP.

For the initial India demo, prioritize merchants whose catalogues align with visually verifiable categories:

- skincare: The Derma Co, Clinikally, Dot & Key, Minimalist, Dr. Sheth's, Aqualogica, Pilgrim, Plum, Deconstruct;
- electronics: boAt, Noise, ACwO, Headphone Zone, Portronics;
- apparel and accessories: GIVA, Libas, The House of Rare, Mokobara, Campus Shoes.

A merchant becomes purchasable only after a current listing is imported with a source URL, timestamp, price, inventory state, external product and variant IDs, and exact identifier/size/model evidence. Directory membership alone never produces a verified offer.

Prava UCP can be added as another `CommerceProvider` when Prava supplies the application-facing endpoint and authentication contract. The canonical-product and offer-policy layers remain unchanged.

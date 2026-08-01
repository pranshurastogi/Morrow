import type { ProductObservation } from "../../domain/product-observation";
import { normalizeText } from "../../modules/recognition/normalization";

export interface UcpMerchantDefinition {
  name: string;
  category: string;
  domain: string;
  endpoint: string;
}

export const INDIA_UCP_MERCHANTS: readonly UcpMerchantDefinition[] = [
  {
    name: "boAt Lifestyle",
    category: "consumer electronics",
    domain: "boat-lifestyle.com",
    endpoint: "https://boatlifestylein.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Noise",
    category: "consumer electronics",
    domain: "gonoise.com",
    endpoint: "https://mansinoise.myshopify.com/api/ucp/mcp",
  },
  {
    name: "TheDermaCo",
    category: "skin care",
    domain: "thedermaco.com",
    endpoint: "https://thedermaco.myshopify.com/api/ucp/mcp",
  },
  {
    name: "ACwO",
    category: "electronic accessories",
    domain: "acwo.com",
    endpoint: "https://acwo.myshopify.com/api/ucp/mcp",
  },
  {
    name: "GIVA",
    category: "jewelry",
    domain: "giva.co",
    endpoint: "https://giva-jewelry.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Libas",
    category: "clothing",
    domain: "libas.in",
    endpoint: "https://libasdelhi.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Kapiva",
    category: "health supplements",
    domain: "kapiva.in",
    endpoint: "https://kapiva.in/api/ucp",
  },
  {
    name: "Clinikally",
    category: "skin care",
    domain: "clinikally.com",
    endpoint: "https://clinikally.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Dot & Key",
    category: "skin care",
    domain: "dotandkey.com",
    endpoint: "https://dot-key.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Bombay Shaving Company",
    category: "shaving grooming",
    domain: "bombayshavingcompany.com",
    endpoint: "https://bombay-shaving.myshopify.com/api/ucp/mcp",
  },
  {
    name: "DeoDap",
    category: "general merchandise",
    domain: "deodap.in",
    endpoint: "https://a5aec8.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Mamaearth",
    category: "skin care",
    domain: "mamaearth.in",
    endpoint: "https://mamaearthprod.myshopify.com/api/ucp/mcp",
  },
  {
    name: "The House of Rare",
    category: "clothing",
    domain: "thehouseofrare.com",
    endpoint: "https://rarerabbit.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Minimalist",
    category: "skin care",
    domain: "beminimalist.co",
    endpoint: "https://minimalistinc.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Dr. Sheth's",
    category: "skin care",
    domain: "drsheths.com",
    endpoint: "https://dr-sheths.myshopify.com/api/ucp/mcp",
  },
  {
    name: "The Sleep Company",
    category: "home furniture",
    domain: "thesleepcompany.in",
    endpoint: "https://thesleepcompanystore.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Headphone Zone",
    category: "audio electronics",
    domain: "headphonezone.in",
    endpoint: "https://headphone-zone.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Aqualogica",
    category: "skin care",
    domain: "aqualogica.in",
    endpoint: "https://aqualogicaprod.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Pilgrim",
    category: "skin care",
    domain: "discoverpilgrim.com",
    endpoint: "https://discoverpilgrim.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Nobero",
    category: "clothing",
    domain: "nobero.com",
    endpoint: "https://my-dream-store-final.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Kushal's",
    category: "jewelry",
    domain: "kushals.com",
    endpoint: "https://kushalsonline-com.myshopify.com/api/ucp/mcp",
  },
  {
    name: "XYXX Apparels",
    category: "clothing",
    domain: "xyxxcrew.com",
    endpoint: "https://xyxx-apparels.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Littlebox India",
    category: "clothing",
    domain: "littleboxindia.com",
    endpoint: "https://lbindia.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Traya Health",
    category: "hair care",
    domain: "traya.health",
    endpoint: "https://tatvahealth.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Neeman's",
    category: "footwear",
    domain: "neemans.com",
    endpoint: "https://babymarketstore.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Palmonas",
    category: "jewelry",
    domain: "palmonas.com",
    endpoint: "https://palmonas.myshopify.com/api/ucp/mcp",
  },
  {
    name: "MCaffeine",
    category: "skin care",
    domain: "mcaffeine.com",
    endpoint: "https://iamcaffeine.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Peachmode",
    category: "clothing",
    domain: "peachmode.com",
    endpoint: "https://peachm.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Zanducare",
    category: "health supplements",
    domain: "zanducare.com",
    endpoint: "https://zanducare.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Kalkifashion",
    category: "clothing",
    domain: "kalkifashion.com",
    endpoint: "https://us-kalkifashion.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Portronics",
    category: "electronic accessories",
    domain: "portronics.com",
    endpoint: "https://portronicsindia.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Oswaal Books",
    category: "books education",
    domain: "oswaalbooks.com",
    endpoint: "https://oswaalbooks.myshopify.com/api/ucp/mcp",
  },
  {
    name: "OZiva",
    category: "health supplements",
    domain: "oziva.in",
    endpoint: "https://oziva.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Mokobara",
    category: "luggage travel accessories",
    domain: "mokobara.com",
    endpoint: "https://mokobara.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Innovist",
    category: "skin care hair care",
    domain: "innovist.com",
    endpoint: "https://bareanatomy.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Campus Shoes",
    category: "footwear",
    domain: "campusshoes.com",
    endpoint: "https://campusshoess.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Speedo",
    category: "sports apparel",
    domain: "speedo.com",
    endpoint: "https://speedo-main.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Durex India",
    category: "personal health",
    domain: "durexindia.com",
    endpoint: "https://durex-in.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Himalaya Wellness",
    category: "health skin care",
    domain: "himalayawellness.in",
    endpoint: "https://himalaya-wellness-india.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Adilqadri",
    category: "fragrance marketplace",
    domain: "adilqadri.com",
    endpoint: "https://adilqadrihashmi.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Plum Goodness",
    category: "skin care",
    domain: "plumgoodness.com",
    endpoint: "https://plumgoodness-2.myshopify.com/api/ucp/mcp",
  },
  {
    name: "W for Woman",
    category: "clothing",
    domain: "wforwoman.com",
    endpoint: "https://shopforw.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Milton",
    category: "home kitchen",
    domain: "milton.in",
    endpoint: "https://milton-india-store.myshopify.com/api/ucp/mcp",
  },
  {
    name: "iCruze Lifestyle",
    category: "electronic accessories",
    domain: "icruze-digital.com",
    endpoint: "https://www-icruze-in.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Supertails",
    category: "pets",
    domain: "supertails.com",
    endpoint: "https://supertail.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Salty",
    category: "jewelry",
    domain: "salty.co.in",
    endpoint: "https://saltyjewels.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Bacca Bucci",
    category: "footwear",
    domain: "baccabucci.com",
    endpoint: "https://baccabucci.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Aachho",
    category: "clothing",
    domain: "aachho.com",
    endpoint: "https://www-aachho-com.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Renee Cosmetics",
    category: "makeup cosmetics",
    domain: "reneecosmetics.in",
    endpoint: "https://reneeofficial.myshopify.com/api/ucp/mcp",
  },
  {
    name: "Deconstruct",
    category: "skin care",
    domain: "thedeconstruct.in",
    endpoint: "https://thedeconstruct.myshopify.com/api/ucp/mcp",
  },
] as const;

function relevanceScore(
  merchant: UcpMerchantDefinition,
  observation: ProductObservation,
): number {
  const brand = normalizeText(observation.brand ?? "");
  const name = normalizeText(merchant.name);
  const category = normalizeText(
    [observation.category, observation.subcategory].filter(Boolean).join(" "),
  );
  let score = 0;
  if (brand && (brand.includes(name) || name.includes(brand))) score += 10;
  for (const token of category.split(" ")) {
    if (token.length > 2 && normalizeText(merchant.category).includes(token)) {
      score += 1;
    }
  }
  return score;
}

export function relevantIndianMerchants(
  observation: ProductObservation,
  limit = 2,
): UcpMerchantDefinition[] {
  return INDIA_UCP_MERCHANTS.map((merchant) => ({
    merchant,
    score: relevanceScore(merchant, observation),
  }))
    .filter((item) => item.score >= 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.merchant);
}

export function merchantByDomain(
  domain: string,
): UcpMerchantDefinition | undefined {
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  return INDIA_UCP_MERCHANTS.find((merchant) => {
    const endpointHost = new URL(merchant.endpoint).hostname.toLowerCase();
    return (
      merchant.domain.toLowerCase().replace(/^www\./, "") === normalized ||
      endpointHost === normalized
    );
  });
}

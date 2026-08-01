export interface AddressInput {
  label: string;
  recipientName: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  phone: string;
  isDefault: boolean;
}

export interface UserAddress extends AddressInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface PravaCardSummary {
  id: string;
  last4: string;
  brand: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  status: "active" | "deleted";
  createdAt: string;
}

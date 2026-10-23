export type Product = {
  id: string;
  service_id: string;
  name: string;
  description: string;
  price_satang: number;
  photo_url: string;
  updated_at: string;
};

export type ProductStore = { id: string; name: string; address: string; product_count: number };
export type CartLine = { product_id: string; name: string; price_satang: number; quantity: number; line_total_satang: number };
export type CustomerCart = {
  available?: true;
  service_id: string;
  store_name: string;
  items: CartLine[];
  fulfillment: "pickup" | "delivery";
  address: string;
  subtotal_satang: number;
  shipping_satang: number;
  total_satang: number;
};

export const DEMO_SHIPPING_SATANG = 5000;
export const PRODUCT_CATEGORIES = ["community_product"] as const;

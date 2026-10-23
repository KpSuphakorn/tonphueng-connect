import { createServiceClient } from "./supabase";
import type { CustomerCart } from "./product-types";
import { isProductId } from "./products";

export type CartInput = { service_id: string; items: Array<{ product_id: string; quantity: number }>; fulfillment: "pickup" | "delivery"; address: string };

export function validCartInput(value: unknown): value is CartInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).sort().join(",") !== "address,fulfillment,items,service_id" || !isProductId(input.service_id)
    || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 100
    || (input.fulfillment !== "pickup" && input.fulfillment !== "delivery") || typeof input.address !== "string") return false;
  if (input.fulfillment === "pickup" ? input.address !== "" : input.address.trim().length < 5 || input.address.length > 500) return false;
  const ids = new Set<string>();
  return input.items.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const row = item as Record<string, unknown>;
    if (Object.keys(row).sort().join(",") !== "product_id,quantity" || !isProductId(row.product_id)
      || !Number.isInteger(row.quantity) || (row.quantity as number) < 1 || (row.quantity as number) > 99 || ids.has(row.product_id)) return false;
    ids.add(row.product_id);
    return true;
  });
}

export async function readCustomerCart(customerId: string): Promise<CustomerCart | null> {
  const { data, error } = await createServiceClient().rpc("read_customer_cart", { target_customer_id: customerId });
  if (error) throw error;
  return data as CustomerCart | null;
}

export async function saveCustomerCart(customerId: string, input: CartInput): Promise<CustomerCart> {
  const { data, error } = await createServiceClient().rpc("save_customer_cart", {
    target_customer_id: customerId, target_service_id: input.service_id,
    target_items: input.items, target_fulfillment: input.fulfillment,
    target_address: input.address,
  });
  if (error) throw error;
  return data as CustomerCart;
}

export async function clearCustomerCart(customerId: string, expectedServiceId: string) {
  const { error } = await createServiceClient().rpc("clear_customer_cart", {
    target_customer_id: customerId, target_expected_service_id: expectedServiceId,
  });
  if (error) throw error;
}

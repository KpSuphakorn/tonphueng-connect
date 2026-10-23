import { createServiceClient } from "./supabase";
import { isProductId } from "./products";

export const ORDER_STATUSES = ["pending_payment", "paid", "preparing", "shipping", "delivered"] as const;
export const STAFF_ORDER_STATUSES = ["preparing", "shipping", "delivered"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type StaffOrderStatus = (typeof STAFF_ORDER_STATUSES)[number];
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "รอยืนยันจ่ายเงินจำลอง",
  paid: "รอร้านรับออเดอร์",
  preparing: "กำลังเตรียมของ",
  shipping: "กำลังไปส่งของ",
  delivered: "ส่งของเรียบร้อยแล้ว",
};

export type OrderItem = { product_id: string; product_name: string; unit_price_satang: number; quantity: number; line_total_satang: number };
export type ProductOrder = {
  id: string; service_id: string; store_name: string; fulfillment: "pickup" | "delivery"; delivery_address: string;
  subtotal_satang: number; shipping_satang: number; total_satang: number; payment_method: "simulated_demo";
  payment_status: "pending_simulated" | "paid_simulated"; status: OrderStatus; tracking_number: string | null;
  created_at: string; paid_at: string | null; status_updated_at: string; items: OrderItem[];
};

const ORDER_KEYS = ["id", "service_id", "store_name", "fulfillment", "delivery_address", "subtotal_satang", "shipping_satang", "total_satang",
  "payment_method", "payment_status", "status", "tracking_number", "created_at", "paid_at", "status_updated_at", "items"] as const;
const ORDER_SELECT = `${ORDER_KEYS.filter((key) => key !== "items").join(",")},items:product_order_items(product_id,product_name,unit_price_satang,quantity,line_total_satang)`;
const TRACKING = /^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,59}$/;

export function publicOrder(value: Record<string, unknown>): ProductOrder {
  const order = Object.fromEntries(ORDER_KEYS.map((key) => [key, value[key]])) as ProductOrder;
  order.items = Array.isArray(order.items) ? [...order.items].sort((a, b) => a.product_name.localeCompare(b.product_name)) : [];
  return order;
}

export function errorCode(error: unknown) { return error && typeof error === "object" && "code" in error ? String(error.code) : ""; }
export function errorMessage(error: unknown) { return error && typeof error === "object" && "message" in error ? String(error.message) : ""; }

/** The browser sends only a request UUID and the store it reviewed; items, prices, fees and owner come from the server cart. */
export function validCreateOrderInput(value: unknown): value is { request_id: string; expected_service_id: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return Object.keys(input).sort().join(",") === "expected_service_id,request_id" && isProductId(input.request_id) && isProductId(input.expected_service_id);
}

/** Tracking is optional; an empty string clears it. Pickup Orders reject any tracking number in PostgreSQL. */
export function parseStaffOrderUpdate(value: unknown): { status: StaffOrderStatus; tracking_number: string | null } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).sort().join(",") !== "status,tracking_number" || !STAFF_ORDER_STATUSES.includes(input.status as StaffOrderStatus)
    || typeof input.tracking_number !== "string" || input.tracking_number.length > 100) return null;
  const tracking = input.tracking_number.trim();
  if (tracking && !TRACKING.test(tracking)) return null;
  return { status: input.status as StaffOrderStatus, tracking_number: tracking || null };
}

export async function createProductOrder(customerId: string, input: { request_id: string; expected_service_id: string }) {
  const { data, error } = await createServiceClient().rpc("create_product_order", {
    target_customer_id: customerId, target_request_id: input.request_id, target_expected_service_id: input.expected_service_id,
  });
  if (error) throw error;
  return publicOrder(data as Record<string, unknown>);
}

export async function confirmProductOrder(customerId: string, orderId: string) {
  const { data, error } = await createServiceClient().rpc("confirm_product_order", { target_customer_id: customerId, target_order_id: orderId });
  if (error) throw error;
  return publicOrder(data as Record<string, unknown>);
}

export async function listCustomerOrders(customerId: string) {
  const { data, error } = await createServiceClient().from("product_orders").select(ORDER_SELECT)
    .eq("customer_account_id", customerId).order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(publicOrder);
}

export async function getCustomerOrder(customerId: string, orderId: string) {
  if (!isProductId(orderId)) return null;
  const { data, error } = await createServiceClient().from("product_orders").select(ORDER_SELECT)
    .eq("id", orderId).eq("customer_account_id", customerId).maybeSingle();
  if (error) throw error;
  return data ? publicOrder(data as unknown as Record<string, unknown>) : null;
}

/** Staff see only paid Orders of the community-product store they own; unpaid Orders are never a Staff task. */
export async function listStaffOrders(staffId: string) {
  const client = createServiceClient();
  const { data: store, error: storeError } = await client.from("services").select("id,category").eq("account_id", staffId).maybeSingle();
  if (storeError) throw storeError;
  if (!store || store.category !== "community_product") return null;
  const { data, error } = await client.from("product_orders").select(ORDER_SELECT)
    .eq("service_id", store.id).eq("payment_status", "paid_simulated").order("paid_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(publicOrder);
}

export async function updateStaffOrder(staffId: string, orderId: string, input: { status: StaffOrderStatus; tracking_number: string | null }) {
  const { data, error } = await createServiceClient().rpc("update_staff_product_order", {
    target_staff_id: staffId, target_order_id: orderId, target_status: input.status, target_tracking_number: input.tracking_number,
  });
  if (error) throw error;
  return publicOrder(data as Record<string, unknown>);
}

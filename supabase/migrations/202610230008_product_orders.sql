-- Ticket 07: product Orders created atomically from the Customer's saved single-store cart.
-- Payment is a demo simulation only: no real money, payment provider or bank verification exists.
create table public.product_orders (
  id uuid primary key default gen_random_uuid(),
  customer_account_id uuid not null references public.app_accounts (id) on delete cascade,
  request_id uuid not null,
  request_payload jsonb not null,
  service_id uuid not null references public.services (id) on delete restrict,
  store_name text not null,
  fulfillment text not null check (fulfillment in ('pickup', 'delivery')),
  delivery_address text not null default '',
  subtotal_satang bigint not null check (subtotal_satang between 1 and 1000000000000),
  shipping_satang integer not null,
  total_satang bigint not null,
  payment_method text not null default 'simulated_demo' check (payment_method = 'simulated_demo'),
  payment_status text not null default 'pending_simulated' check (payment_status in ('pending_simulated', 'paid_simulated')),
  status text not null default 'pending_payment' check (status in ('pending_payment', 'paid', 'preparing', 'shipping', 'delivered')),
  tracking_number text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  status_updated_at timestamptz not null default now(),
  unique (customer_account_id, request_id),
  check ((fulfillment = 'pickup' and delivery_address = '' and shipping_satang = 0)
    or (fulfillment = 'delivery' and char_length(trim(delivery_address)) between 5 and 500 and shipping_satang = 5000)),
  check (total_satang = subtotal_satang + shipping_satang),
  check ((payment_status = 'pending_simulated' and paid_at is null and status = 'pending_payment')
    or (payment_status = 'paid_simulated' and paid_at is not null and status <> 'pending_payment')),
  check (tracking_number is null or (fulfillment = 'delivery' and tracking_number ~ '^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,59}$'))
);

create index product_orders_customer_idx on public.product_orders (customer_account_id, created_at desc);
create index product_orders_store_idx on public.product_orders (service_id, payment_status, paid_at desc);
alter table public.product_orders enable row level security;
revoke all on table public.product_orders from public, anon, authenticated;
grant select, insert, update on table public.product_orders to service_role;

create table public.product_order_items (
  order_id uuid not null references public.product_orders (id) on delete cascade,
  product_id uuid not null,
  product_name text not null check (char_length(trim(product_name)) between 1 and 160),
  unit_price_satang integer not null check (unit_price_satang between 1 and 100000000),
  quantity integer not null check (quantity between 1 and 99),
  line_total_satang bigint not null,
  primary key (order_id, product_id),
  check (line_total_satang = unit_price_satang::bigint * quantity)
);

alter table public.product_order_items enable row level security;
revoke all on table public.product_order_items from public, anon, authenticated;
-- Item snapshots are immutable after creation: no update/delete grant.
grant select, insert on table public.product_order_items to service_role;

create or replace function public.product_order_json(target_order_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select (to_jsonb(o) - 'request_payload' - 'customer_account_id' - 'request_id') || jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object('product_id', i.product_id, 'product_name', i.product_name,
      'unit_price_satang', i.unit_price_satang, 'quantity', i.quantity, 'line_total_satang', i.line_total_satang) order by i.product_name)
    from public.product_order_items as i where i.order_id = o.id), '[]'::jsonb))
  from public.product_orders as o where o.id = target_order_id;
$$;

create or replace function public.create_product_order(target_customer_id uuid, target_request_id uuid, target_expected_service_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  payload jsonb;
  existing public.product_orders%rowtype;
  cart public.customer_carts%rowtype;
  store_name text;
  item_count integer;
  subtotal bigint;
  shipping integer;
  created public.product_orders%rowtype;
begin
  if target_customer_id is null or target_request_id is null or target_expected_service_id is null then
    raise exception 'invalid order request' using errcode = '22023';
  end if;
  if not exists (select 1 from public.app_accounts as a where a.id = target_customer_id and a.role = 'customer' and a.status = 'active') then
    raise exception 'customer is not active' using errcode = '42501';
  end if;
  payload := jsonb_build_object('expected_service_id', target_expected_service_id);
  -- Same lock key as save/clear cart so the cart cannot change while it becomes an Order.
  perform pg_advisory_xact_lock(hashtextextended(target_customer_id::text, 6));
  select * into existing from public.product_orders as o
  where o.customer_account_id = target_customer_id and o.request_id = target_request_id;
  if found then
    if existing.request_payload <> payload then raise exception 'request id reused' using errcode = '23505'; end if;
    return public.product_order_json(existing.id);
  end if;
  select * into cart from public.customer_carts as c where c.customer_account_id = target_customer_id for update;
  if not found then raise exception 'cart empty' using errcode = 'P0002'; end if;
  if cart.service_id <> target_expected_service_id then raise exception 'cart changed' using errcode = '40001'; end if;
  -- Lock the cart's Product rows so a concurrent price change or archive cannot split the header subtotal from the item snapshot.
  perform 1 from public.products as p join public.customer_cart_items as i on i.product_id = p.id
  where i.customer_account_id = target_customer_id for share of p;
  select s.name into store_name from public.services as s join public.app_accounts as a on a.id = s.account_id
  where s.id = cart.service_id and s.category = 'community_product' and a.role = 'staff' and a.status = 'active';
  if store_name is null then raise exception 'cart unavailable' using errcode = '22023'; end if;
  select count(*), sum(p.price_satang::bigint * i.quantity) into item_count, subtotal
  from public.customer_cart_items as i
  left join public.products as p on p.id = i.product_id and p.service_id = cart.service_id and p.active
  where i.customer_account_id = target_customer_id;
  if item_count = 0 then raise exception 'cart empty' using errcode = 'P0002'; end if;
  if exists (select 1 from public.customer_cart_items as i
    left join public.products as p on p.id = i.product_id and p.service_id = cart.service_id and p.active
    where i.customer_account_id = target_customer_id and p.id is null) then
    raise exception 'cart unavailable' using errcode = '22023';
  end if;
  shipping := case when cart.fulfillment = 'delivery' then 5000 else 0 end;
  insert into public.product_orders (customer_account_id, request_id, request_payload, service_id, store_name, fulfillment,
    delivery_address, subtotal_satang, shipping_satang, total_satang)
  values (target_customer_id, target_request_id, payload, cart.service_id, store_name, cart.fulfillment,
    cart.delivery_address, subtotal, shipping, subtotal + shipping)
  returning * into created;
  insert into public.product_order_items (order_id, product_id, product_name, unit_price_satang, quantity, line_total_satang)
  select created.id, p.id, p.name, p.price_satang, i.quantity, p.price_satang::bigint * i.quantity
  from public.customer_cart_items as i
  join public.products as p on p.id = i.product_id and p.service_id = cart.service_id and p.active
  where i.customer_account_id = target_customer_id;
  delete from public.customer_carts where customer_account_id = target_customer_id;
  return public.product_order_json(created.id);
exception when unique_violation then
  select * into existing from public.product_orders as o
  where o.customer_account_id = target_customer_id and o.request_id = target_request_id;
  if found and existing.request_payload = payload then return public.product_order_json(existing.id); end if;
  raise exception 'request id reused' using errcode = '23505';
end;
$$;

create or replace function public.confirm_product_order(target_customer_id uuid, target_order_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_row public.product_orders%rowtype;
begin
  if not exists (select 1 from public.app_accounts as a where a.id = target_customer_id and a.role = 'customer' and a.status = 'active') then
    raise exception 'customer is not active' using errcode = '42501';
  end if;
  select o.* into current_row from public.product_orders as o
  where o.id = target_order_id and o.customer_account_id = target_customer_id for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  -- Repeating a confirmation returns the existing simulated result without creating a second success.
  if current_row.payment_status = 'paid_simulated' then return public.product_order_json(current_row.id); end if;
  -- A suspended store must not receive a newly paid Order that no active Staff can see.
  if not exists (select 1 from public.services as s join public.app_accounts as a on a.id = s.account_id
    where s.id = current_row.service_id and s.category = 'community_product' and a.role = 'staff' and a.status = 'active') then
    raise exception 'store unavailable' using errcode = '22023';
  end if;
  update public.product_orders as o set payment_status = 'paid_simulated', paid_at = now(), status = 'paid', status_updated_at = now()
  where o.id = current_row.id;
  return public.product_order_json(current_row.id);
end;
$$;

create or replace function public.update_staff_product_order(target_staff_id uuid, target_order_id uuid, target_status text, target_tracking_number text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_row public.product_orders%rowtype;
  tracking text := nullif(trim(coalesce(target_tracking_number, '')), '');
  rank_of constant jsonb := '{"paid": 1, "preparing": 2, "shipping": 3, "delivered": 4}';
begin
  if target_status is null or target_status not in ('preparing', 'shipping', 'delivered') then
    raise exception 'invalid order status' using errcode = '22023';
  end if;
  select o.* into current_row from public.product_orders as o
  join public.services as s on s.id = o.service_id
  join public.app_accounts as a on a.id = s.account_id
  where o.id = target_order_id and s.account_id = target_staff_id and a.role = 'staff' and a.status = 'active'
    and o.payment_status = 'paid_simulated'
  for update of o;
  if not found then raise exception 'order not found' using errcode = '42501'; end if;
  if (rank_of->>target_status)::integer < (rank_of->>current_row.status)::integer then
    raise exception 'order status cannot move backward' using errcode = '22023';
  end if;
  if current_row.fulfillment = 'pickup' and tracking is not null then
    raise exception 'tracking number not allowed for pickup' using errcode = '22023';
  end if;
  if tracking is not null and tracking !~ '^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,59}$' then
    raise exception 'invalid tracking number' using errcode = '22023';
  end if;
  update public.product_orders as o set status = target_status, tracking_number = tracking,
    status_updated_at = case when o.status = target_status and o.tracking_number is not distinct from tracking then o.status_updated_at else now() end
  where o.id = current_row.id;
  return public.product_order_json(current_row.id);
end;
$$;

revoke all on function public.product_order_json(uuid) from public, anon, authenticated, service_role;
revoke all on function public.create_product_order(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.confirm_product_order(uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_staff_product_order(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_product_order(uuid, uuid, uuid) to service_role;
grant execute on function public.confirm_product_order(uuid, uuid) to service_role;
grant execute on function public.update_staff_product_order(uuid, uuid, text, text) to service_role;

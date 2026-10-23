alter table public.staff_photo_upload_sessions drop constraint staff_photo_upload_sessions_flow_check;
alter table public.staff_photo_upload_sessions add constraint staff_photo_upload_sessions_flow_check check (flow in ('registration', 'profile', 'product'));
alter table public.staff_photo_upload_sessions drop constraint staff_photo_upload_path_count_check;
alter table public.staff_photo_upload_sessions add constraint staff_photo_upload_path_count_check check (
  array_length(staging_paths, 1) = cardinality(staging_paths)
  and (flow <> 'product' or cardinality(staging_paths) = 1)
);
alter table public.staff_photo_upload_sessions drop constraint staff_photo_upload_account_flow_check;
alter table public.staff_photo_upload_sessions add constraint staff_photo_upload_account_flow_check check (
  (flow = 'registration' and account_id is null) or (flow in ('profile', 'product') and account_id is not null)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 4000),
  price_satang integer not null check (price_satang between 1 and 100000000),
  photo_path text not null check (photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_service_active_idx on public.products (service_id, active, created_at desc);
alter table public.products enable row level security;
revoke all on table public.products from public, anon, authenticated;
grant select, insert, update, delete on table public.products to service_role;

create table public.customer_carts (
  customer_account_id uuid primary key references public.app_accounts (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  fulfillment text not null default 'pickup' check (fulfillment in ('pickup', 'delivery')),
  delivery_address text not null default '',
  updated_at timestamptz not null default now(),
  check ((fulfillment = 'pickup' and delivery_address = '') or (fulfillment = 'delivery' and char_length(trim(delivery_address)) between 5 and 500))
);
create table public.customer_cart_items (
  customer_account_id uuid not null references public.customer_carts (customer_account_id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity between 1 and 99),
  primary key (customer_account_id, product_id)
);
alter table public.customer_carts enable row level security;
alter table public.customer_cart_items enable row level security;
revoke all on table public.customer_carts, public.customer_cart_items from public, anon, authenticated;
grant select, insert, update, delete on table public.customer_carts, public.customer_cart_items to service_role;

create or replace function public.create_staff_photo_upload_session(
  target_id uuid, target_token_hash text, target_flow text, target_account_id uuid, target_staging_paths text[]
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if cardinality(target_staging_paths) not between 1 and 19
    or (target_flow = 'product' and cardinality(target_staging_paths) <> 1)
    or exists (select 1 from unnest(target_staging_paths) as paths(path) where path not like target_id::text || '/%')
    or cardinality(target_staging_paths) <> (select count(distinct path) from unnest(target_staging_paths) as paths(path)) then
    raise exception 'invalid photo count or path' using errcode = '22023';
  end if;
  if target_flow = 'registration' then
    perform pg_advisory_xact_lock(hashtextextended('staff-photo-registration-quota', 0));
    if (select count(*) from public.staff_photo_upload_sessions where flow = 'registration' and created_at > now() - interval '2 hours') >= 25 then
      raise exception 'registration photo upload quota reached' using errcode = '54000';
    end if;
  elsif target_flow in ('profile', 'product') and target_account_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(target_account_id::text || target_flow, 0));
    if (select count(*) from public.staff_photo_upload_sessions where flow = target_flow and account_id = target_account_id and created_at > now() - interval '2 hours') >= (case target_flow when 'profile' then 5 else 10 end) then
      raise exception 'staff photo upload quota reached' using errcode = '54000';
    end if;
    if not exists (select 1 from public.app_accounts where id = target_account_id and role = 'staff' and status = 'active') then
      raise exception 'staff is not active' using errcode = '42501';
    end if;
  else
    raise exception 'invalid upload flow' using errcode = '22023';
  end if;
  insert into public.staff_photo_upload_sessions (id, token_hash, flow, account_id, staging_paths)
  values (target_id, target_token_hash, target_flow, target_account_id, target_staging_paths);
end;
$$;

create or replace function public.save_staff_product(
  target_account_id uuid, target_product_id uuid, target_name text, target_description text, target_price_satang integer,
  target_photo_path text, target_keep_photo boolean default false
) returns setof public.products language plpgsql security definer set search_path = '' as $$
declare
  current_row public.products%rowtype;
  saved public.products%rowtype;
begin
  if not exists (select 1 from public.app_accounts a join public.services s on s.account_id = a.id
    where a.id = target_account_id and a.role = 'staff' and a.status = 'active' and s.category = 'community_product') then
    raise exception 'staff or store unavailable' using errcode = '42501';
  end if;
  if target_name is null or char_length(trim(target_name)) not between 1 and 160
    or target_description is null or char_length(target_description) > 4000
    or target_price_satang not between 1 and 100000000 then
    raise exception 'invalid product' using errcode = '22023';
  end if;
  if target_product_id is null then
    if target_photo_path is null or target_photo_path not like target_account_id::text || '/%.webp' then
      raise exception 'product photo required' using errcode = '22023';
    end if;
    insert into public.products(service_id, name, description, price_satang, photo_path)
    select s.id, trim(target_name), trim(target_description), target_price_satang, target_photo_path
    from public.services s where s.account_id = target_account_id and s.category = 'community_product'
    returning * into saved;
  else
    select p.* into current_row from public.products p join public.services s on s.id = p.service_id
    where p.id = target_product_id and s.account_id = target_account_id and s.category = 'community_product' for update;
    if not found then raise exception 'product not found' using errcode = '42501'; end if;
    if target_keep_photo then
      update public.products set name = trim(target_name), description = trim(target_description), price_satang = target_price_satang, updated_at = now()
      where id = target_product_id returning * into saved;
    else
      if target_photo_path is null or target_photo_path not like target_account_id::text || '/%.webp' then
        raise exception 'product photo required' using errcode = '22023';
      end if;
      update public.products set name = trim(target_name), description = trim(target_description), price_satang = target_price_satang, photo_path = target_photo_path, updated_at = now()
      where id = target_product_id returning * into saved;
    end if;
  end if;
  return next saved;
end;
$$;

create or replace function public.archive_staff_product(target_account_id uuid, target_product_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.products p set active = false, updated_at = now()
  from public.services s where p.service_id = s.id and s.account_id = target_account_id and p.id = target_product_id;
  if not found then raise exception 'product not found' using errcode = '42501'; end if;
end;
$$;

create or replace function public.read_customer_cart(target_customer_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; item_count integer;
begin
  if not exists (select 1 from public.app_accounts where id = target_customer_id and role = 'customer' and status = 'active') then
    raise exception 'customer is not active' using errcode = '42501';
  end if;
  if not exists (select 1 from public.customer_carts where customer_account_id = target_customer_id) then return null; end if;
  select count(*) into item_count from public.customer_cart_items where customer_account_id = target_customer_id;
  if item_count = 0 then
    select jsonb_build_object('available', false, 'service_id', c.service_id, 'store_name', s.name, 'items', '[]'::jsonb)
      into result from public.customer_carts c join public.services s on s.id = c.service_id where c.customer_account_id = target_customer_id;
    return result;
  end if;
  if exists (
    select 1 from public.customer_cart_items i
    join public.customer_carts c on c.customer_account_id = i.customer_account_id
    left join public.products p on p.id = i.product_id and p.service_id = c.service_id and p.active
    left join public.services s on s.id = c.service_id and s.category = 'community_product'
    left join public.app_accounts a on a.id = s.account_id and a.role = 'staff' and a.status = 'active'
    where i.customer_account_id = target_customer_id and (p.id is null or a.id is null)
  ) then
    select jsonb_build_object('available', false, 'service_id', c.service_id, 'store_name', s.name,
      'items', jsonb_agg(jsonb_build_object('product_id', i.product_id, 'quantity', i.quantity)))
      into result from public.customer_carts c join public.services s on s.id = c.service_id
      join public.customer_cart_items i on i.customer_account_id = c.customer_account_id
      where c.customer_account_id = target_customer_id group by c.service_id, s.name;
    return result;
  end if;
  select jsonb_build_object(
    'available', true, 'service_id', c.service_id, 'store_name', s.name, 'fulfillment', c.fulfillment, 'address', c.delivery_address,
    'items', jsonb_agg(jsonb_build_object('product_id', p.id, 'name', p.name, 'price_satang', p.price_satang,
      'quantity', i.quantity, 'line_total_satang', p.price_satang::bigint * i.quantity) order by p.name),
    'subtotal_satang', sum(p.price_satang::bigint * i.quantity),
    'shipping_satang', case when c.fulfillment = 'delivery' then 5000 else 0 end,
    'total_satang', sum(p.price_satang::bigint * i.quantity) + case when c.fulfillment = 'delivery' then 5000 else 0 end
  ) into result
  from public.customer_carts c join public.services s on s.id = c.service_id
  join public.customer_cart_items i on i.customer_account_id = c.customer_account_id
  join public.products p on p.id = i.product_id
  where c.customer_account_id = target_customer_id group by c.service_id, s.name, c.fulfillment, c.delivery_address;
  return result;
end;
$$;

create or replace function public.save_customer_cart(
  target_customer_id uuid, target_service_id uuid, target_items jsonb, target_fulfillment text, target_address text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare cart_service uuid; item jsonb; product_count integer; item_total integer;
begin
  if not exists (select 1 from public.app_accounts where id = target_customer_id and role = 'customer' and status = 'active') then
    raise exception 'customer is not active' using errcode = '42501';
  end if;
  if jsonb_typeof(target_items) <> 'array' or jsonb_array_length(target_items) not between 1 and 100
    or target_fulfillment not in ('pickup', 'delivery')
    or (target_fulfillment = 'pickup' and coalesce(target_address, '') <> '')
    or (target_fulfillment = 'delivery' and char_length(trim(coalesce(target_address, ''))) not between 5 and 500) then
    raise exception 'invalid cart' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_customer_id::text, 6));
  select service_id into cart_service from public.customer_carts where customer_account_id = target_customer_id for update;
  if cart_service is not null and cart_service <> target_service_id then raise exception 'cart store mismatch' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.services s join public.app_accounts a on a.id = s.account_id
    where s.id = target_service_id and s.category = 'community_product' and a.role = 'staff' and a.status = 'active') then
    raise exception 'store unavailable' using errcode = '22023';
  end if;
  select count(*), count(distinct value->>'product_id') into item_total, product_count
  from jsonb_array_elements(target_items);
  if item_total <> product_count then raise exception 'duplicate product' using errcode = '22023'; end if;
  for item in select value from jsonb_array_elements(target_items) loop
    if jsonb_typeof(item->'quantity') <> 'number' or (item->>'quantity') !~ '^[0-9]{1,2}$'
      or (item->>'quantity')::integer not between 1 and 99
      or not exists (select 1 from public.products p where p.id = (item->>'product_id')::uuid and p.service_id = target_service_id and p.active) then
      raise exception 'product unavailable or quantity invalid' using errcode = '22023';
    end if;
  end loop;
  insert into public.customer_carts(customer_account_id, service_id, fulfillment, delivery_address)
  values (target_customer_id, target_service_id, target_fulfillment, coalesce(target_address, ''))
  on conflict (customer_account_id) do update set fulfillment = excluded.fulfillment, delivery_address = excluded.delivery_address, updated_at = now();
  delete from public.customer_cart_items where customer_account_id = target_customer_id;
  insert into public.customer_cart_items(customer_account_id, product_id, quantity)
  select target_customer_id, (value->>'product_id')::uuid, (value->>'quantity')::integer from jsonb_array_elements(target_items);
  return public.read_customer_cart(target_customer_id);
exception when invalid_text_representation then
  raise exception 'product unavailable or quantity invalid' using errcode = '22023';
end;
$$;

create or replace function public.clear_customer_cart(target_customer_id uuid, target_expected_service_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare current_service uuid;
begin
  if not exists (select 1 from public.app_accounts where id = target_customer_id and role = 'customer' and status = 'active') then
    raise exception 'customer is not active' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_customer_id::text, 6));
  select service_id into current_service from public.customer_carts where customer_account_id = target_customer_id for update;
  if current_service is not null and current_service <> target_expected_service_id then raise exception 'cart changed' using errcode = '40001'; end if;
  delete from public.customer_carts where customer_account_id = target_customer_id;
end;
$$;

revoke all on function public.save_staff_product(uuid, uuid, text, text, integer, text, boolean) from public, anon, authenticated;
revoke all on function public.archive_staff_product(uuid, uuid) from public, anon, authenticated;
revoke all on function public.read_customer_cart(uuid) from public, anon, authenticated;
revoke all on function public.save_customer_cart(uuid, uuid, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.clear_customer_cart(uuid, uuid) from public, anon, authenticated;
grant execute on function public.save_staff_product(uuid, uuid, text, text, integer, text, boolean) to service_role;
grant execute on function public.archive_staff_product(uuid, uuid) to service_role;
grant execute on function public.read_customer_cart(uuid) to service_role;
grant execute on function public.save_customer_cart(uuid, uuid, jsonb, text, text) to service_role;
grant execute on function public.clear_customer_cart(uuid, uuid) to service_role;

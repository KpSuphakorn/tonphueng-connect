create table public.package_bookings (
  id uuid primary key default gen_random_uuid(),
  customer_account_id uuid not null references public.app_accounts (id) on delete cascade,
  request_id uuid not null,
  request_payload jsonb not null,
  category text not null check (category in ('trail_running', 'wildfire_study', 'cultural_study_trip')),
  sub_package_id uuid not null,
  catalog_revision bigint not null check (catalog_revision > 0),
  package_snapshot jsonb not null check (jsonb_typeof(package_snapshot) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'paid_simulated')),
  start_date date not null,
  end_date date not null,
  participants integer not null check (participants between 1 and 100),
  price_per_person_satang integer not null check (price_per_person_satang between 1 and 100000000),
  total_price_satang bigint not null check (total_price_satang between 1 and 10000000000),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  my_trip_added_at timestamptz,
  unique (customer_account_id, request_id),
  check (end_date >= start_date),
  check ((status = 'pending' and confirmed_at is null) or (status = 'paid_simulated' and confirmed_at is not null))
);

create index package_bookings_customer_idx on public.package_bookings (customer_account_id, created_at desc);
alter table public.package_bookings enable row level security;
revoke all on table public.package_bookings from public, anon, authenticated;
grant select, insert, update on table public.package_bookings to service_role;

create table public.my_trip_booking_services (
  customer_account_id uuid not null references public.app_accounts (id) on delete cascade,
  booking_id uuid not null references public.package_bookings (id) on delete cascade,
  service_id uuid not null,
  service_snapshot jsonb not null check (jsonb_typeof(service_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  primary key (booking_id, service_id)
);

alter table public.my_trip_booking_services enable row level security;
revoke all on table public.my_trip_booking_services from public, anon, authenticated;
grant select, insert on table public.my_trip_booking_services to service_role;

create or replace function public.create_package_booking(
  target_customer_id uuid, target_request_id uuid, target_category text, target_sub_package_id uuid,
  target_revision bigint, target_choices jsonb, target_start_date date, target_participants integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  catalog_row public.package_catalogs%rowtype;
  selected_package jsonb;
  slot jsonb;
  choice jsonb;
  service_id uuid;
  service_row public.services%rowtype;
  required_count integer;
  price integer;
  duration integer;
  payload jsonb;
  snapshot jsonb;
  booking public.package_bookings%rowtype;
begin
  if target_customer_id is null or target_category is null or target_category not in ('trail_running', 'wildfire_study', 'cultural_study_trip')
    or target_request_id is null or target_sub_package_id is null or target_revision is null or target_revision < 1
    or target_participants is null or target_participants not between 1 and 100 or target_choices is null
    or jsonb_typeof(target_choices) <> 'array' or target_start_date is null then
    raise exception 'invalid booking' using errcode = '22023';
  end if;
  payload := jsonb_build_object('category', target_category, 'sub_package_id', target_sub_package_id,
    'revision', target_revision, 'choices', target_choices, 'start_date', target_start_date, 'participants', target_participants);
  if not exists (select 1 from public.app_accounts as a where a.id = target_customer_id and a.role = 'customer' and a.status = 'active') then
    raise exception 'customer is not active' using errcode = '42501';
  end if;
  select * into booking from public.package_bookings as b
  where b.customer_account_id = target_customer_id and b.request_id = target_request_id for update;
  if found then
    if booking.request_payload <> payload then raise exception 'request id reused' using errcode = '23505'; end if;
    return to_jsonb(booking);
  end if;
  if target_start_date < (now() at time zone 'Asia/Bangkok')::date then
    raise exception 'booking date is in the past' using errcode = '22023';
  end if;
  select * into catalog_row from public.package_catalogs as c where c.category = target_category for share;
  if not found or catalog_row.revision <> target_revision then raise exception 'catalog changed' using errcode = '40001'; end if;
  select item.value into selected_package from jsonb_array_elements(catalog_row.catalog->'sub_packages') as item(value)
  where item.value->>'id' = target_sub_package_id::text;
  if selected_package is null or jsonb_typeof(selected_package->'slots') <> 'array'
    or jsonb_array_length(target_choices) <> jsonb_array_length(selected_package->'slots') then
    raise exception 'package or choices missing' using errcode = '22023';
  end if;
  price := (selected_package->>'price_per_person_satang')::integer;
  duration := coalesce((selected_package->>'duration_days')::integer, 1);
  if price not between 1 and 100000000 or duration not between 1 and 30
    or price::bigint * target_participants > 10000000000 then
    raise exception 'invalid package price or duration' using errcode = '22023';
  end if;
  snapshot := jsonb_build_object('category', target_category, 'category_title', target_category,
    'package_title', catalog_row.catalog->>'title', 'sub_package_id', target_sub_package_id,
    'sub_package_title', selected_package->>'title', 'description', selected_package->>'description',
    'duration_days', duration, 'choices', '[]'::jsonb);
  for slot in select item.value from jsonb_array_elements(selected_package->'slots') as item(value) loop
    select item.value into choice from jsonb_array_elements(target_choices) as item(value)
    where item.value->>'slot_id' = slot->>'id';
    required_count := (slot->>'required_count')::integer;
    if choice is null or jsonb_typeof(choice->'service_ids') <> 'array'
      or jsonb_array_length(choice->'service_ids') <> required_count
      or (select count(distinct item.value) from jsonb_array_elements_text(choice->'service_ids') as item(value)) <> required_count then
      raise exception 'slot selection mismatch' using errcode = '22023';
    end if;
    for service_id in select item.value::uuid from jsonb_array_elements_text(choice->'service_ids') as item(value) loop
      begin
        select s.* into service_row from public.services as s join public.app_accounts as a on a.id = s.account_id
        where s.id = service_id and a.role = 'staff' and a.status = 'active';
      exception when invalid_text_representation then
        raise exception 'service unavailable' using errcode = '22023';
      end;
      if not found or service_id::text not in (select jsonb_array_elements_text(slot->'service_ids'))
        or service_row.category is distinct from slot->>'service_category' then
        raise exception 'service unavailable' using errcode = '22023';
      end if;
      snapshot := jsonb_set(snapshot, '{choices}', (snapshot->'choices') || jsonb_build_array(jsonb_build_object(
        'slot_id', slot->>'id', 'slot_name', slot->>'name', 'service', jsonb_build_object('id', service_row.id,
          'name', service_row.name, 'category', service_row.category, 'address', service_row.address,
          'latitude', service_row.latitude, 'longitude', service_row.longitude, 'phone', service_row.phone,
          'description', service_row.description))));
    end loop;
  end loop;
  insert into public.package_bookings (customer_account_id, request_id, request_payload, category, sub_package_id,
    catalog_revision, package_snapshot, start_date, end_date, participants, price_per_person_satang, total_price_satang)
  values (target_customer_id, target_request_id, payload, target_category, target_sub_package_id, target_revision,
    snapshot, target_start_date, target_start_date + duration - 1, target_participants, price, price::bigint * target_participants)
  returning * into booking;
  return to_jsonb(booking);
exception when unique_violation then
  select * into booking from public.package_bookings as b
  where b.customer_account_id = target_customer_id and b.request_id = target_request_id;
  if found and booking.request_payload = payload then return to_jsonb(booking); end if;
  raise exception 'request id reused' using errcode = '23505';
end;
$$;

create or replace function public.confirm_package_booking(target_customer_id uuid, target_booking_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare booking public.package_bookings%rowtype;
begin
  update public.package_bookings as b set status = 'paid_simulated', confirmed_at = coalesce(b.confirmed_at, now())
  where b.id = target_booking_id and b.customer_account_id = target_customer_id returning b.* into booking;
  if not found then raise exception 'booking not found' using errcode = 'P0002'; end if;
  return to_jsonb(booking);
end;
$$;

create or replace function public.add_booking_to_my_trip(target_customer_id uuid, target_booking_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare booking public.package_bookings%rowtype;
  selected jsonb;
begin
  select * into booking from public.package_bookings as b where b.id = target_booking_id
    and b.customer_account_id = target_customer_id for update;
  if not found or booking.status <> 'paid_simulated' then raise exception 'confirmed booking not found' using errcode = 'P0002'; end if;
  for selected in select value->'service' from jsonb_array_elements(booking.package_snapshot->'choices') loop
    insert into public.my_trip_booking_services(customer_account_id, booking_id, service_id, service_snapshot)
    values (target_customer_id, booking.id, (selected->>'id')::uuid, selected)
    on conflict (booking_id, service_id) do nothing;
  end loop;
  update public.package_bookings as b set my_trip_added_at = coalesce(b.my_trip_added_at, now()) where b.id = booking.id returning b.* into booking;
  return to_jsonb(booking);
end;
$$;

revoke all on function public.create_package_booking(uuid, uuid, text, uuid, bigint, jsonb, date, integer) from public, anon, authenticated;
revoke all on function public.confirm_package_booking(uuid, uuid) from public, anon, authenticated;
revoke all on function public.add_booking_to_my_trip(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_package_booking(uuid, uuid, text, uuid, bigint, jsonb, date, integer) to service_role;
grant execute on function public.confirm_package_booking(uuid, uuid) to service_role;
grant execute on function public.add_booking_to_my_trip(uuid, uuid) to service_role;

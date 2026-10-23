create table public.package_catalogs (
  category text primary key check (category in ('trail_running', 'wildfire_study', 'cultural_study_trip')),
  catalog jsonb not null check (jsonb_typeof(catalog) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.package_catalogs enable row level security;
revoke all on table public.package_catalogs from public, anon, authenticated;
grant select, insert, update on table public.package_catalogs to service_role;

create table public.package_customer_selections (
  id uuid primary key default gen_random_uuid(),
  customer_account_id uuid not null references public.app_accounts (id) on delete cascade,
  category text not null check (category in ('trail_running', 'wildfire_study', 'cultural_study_trip')),
  sub_package_id uuid not null,
  catalog_revision bigint not null check (catalog_revision > 0),
  price_per_person_satang integer not null check (price_per_person_satang between 1 and 100000000),
  choices jsonb not null check (jsonb_typeof(choices) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_account_id, sub_package_id)
);

create index package_customer_selections_owner_idx on public.package_customer_selections (customer_account_id, updated_at desc);
alter table public.package_customer_selections enable row level security;
revoke all on table public.package_customer_selections from public, anon, authenticated;
grant select, insert, update on table public.package_customer_selections to service_role;

create or replace function public.save_package_catalog(target_category text, target_expected_revision bigint, target_catalog jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_revision bigint;
begin
  if target_category not in ('trail_running', 'wildfire_study', 'cultural_study_trip')
    or jsonb_typeof(target_catalog) <> 'object'
    or jsonb_typeof(target_catalog->'sub_packages') <> 'array' then
    raise exception 'invalid package catalog' using errcode = '22023';
  end if;
  if target_expected_revision = 0 then
    insert into public.package_catalogs (category, catalog, revision)
    values (target_category, target_catalog, 1)
    on conflict (category) do nothing
    returning revision into saved_revision;
  else
    update public.package_catalogs
    set catalog = target_catalog, revision = revision + 1, updated_at = now()
    where category = target_category and revision = target_expected_revision
    returning revision into saved_revision;
  end if;
  if saved_revision is null then
    raise exception 'package changed' using errcode = '40001';
  end if;
  return saved_revision;
end;
$$;

create or replace function public.save_package_selection(
  target_customer_id uuid,
  target_category text,
  target_sub_package_id uuid,
  target_revision bigint,
  target_choices jsonb
)
returns table (id uuid, catalog_revision bigint, price_per_person_satang integer, choices jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  catalog_row public.package_catalogs%rowtype;
  selected_package jsonb;
  slot jsonb;
  slot_choice jsonb;
  selected_service text;
  service_category text;
  required_count integer;
  saved_id uuid;
  saved_price integer;
begin
  if jsonb_typeof(target_choices) <> 'array' then
    raise exception 'invalid choices' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.app_accounts as account
    where account.id = target_customer_id and account.role = 'customer' and account.status = 'active'
  ) then
    raise exception 'customer is not active' using errcode = '42501';
  end if;
  select * into catalog_row from public.package_catalogs
  where category = target_category for share;
  if not found or catalog_row.revision <> target_revision then
    raise exception 'package changed' using errcode = '40001';
  end if;
  select item.value into selected_package
  from jsonb_array_elements(catalog_row.catalog->'sub_packages') as item(value)
  where item.value->>'id' = target_sub_package_id::text;
  if selected_package is null then
    raise exception 'package missing' using errcode = '22023';
  end if;
  saved_price := (selected_package->>'price_per_person_satang')::integer;
  if jsonb_typeof(selected_package->'slots') <> 'array'
    or jsonb_array_length(target_choices) <> jsonb_array_length(selected_package->'slots') then
    raise exception 'selection count mismatch' using errcode = '22023';
  end if;
  for slot in select item.value from jsonb_array_elements(selected_package->'slots') as item(value) loop
    select choice.value into slot_choice
    from jsonb_array_elements(target_choices) as choice(value)
    where choice.value->>'slot_id' = slot->>'id';
    required_count := (slot->>'required_count')::integer;
    if slot_choice is null
      or jsonb_typeof(slot_choice->'service_ids') <> 'array'
      or jsonb_array_length(slot_choice->'service_ids') <> required_count
      or (select count(distinct item.value) from jsonb_array_elements_text(slot_choice->'service_ids') as item(value)) <> required_count then
      raise exception 'selection count mismatch' using errcode = '22023';
    end if;
    for selected_service in select item.value from jsonb_array_elements_text(slot_choice->'service_ids') as item(value) loop
      if not exists (
        select 1 from jsonb_array_elements_text(slot->'service_ids') as option_id(value)
        where option_id.value = selected_service
      ) then
        raise exception 'service not allowed' using errcode = '22023';
      end if;
      begin
        select service.category into service_category
        from public.services as service
        join public.app_accounts as account on account.id = service.account_id
        where service.id = selected_service::uuid and account.role = 'staff' and account.status = 'active';
      exception when invalid_text_representation then
        raise exception 'service not allowed' using errcode = '22023';
      end;
      if service_category is distinct from slot->>'service_category' then
        raise exception 'service category mismatch' using errcode = '22023';
      end if;
    end loop;
  end loop;
  insert into public.package_customer_selections
    (customer_account_id, category, sub_package_id, catalog_revision, price_per_person_satang, choices)
  values (target_customer_id, target_category, target_sub_package_id, catalog_row.revision, saved_price, target_choices)
  on conflict (customer_account_id, sub_package_id) do update
  set category = excluded.category,
      catalog_revision = excluded.catalog_revision,
      price_per_person_satang = excluded.price_per_person_satang,
      choices = excluded.choices,
      updated_at = now()
  returning package_customer_selections.id into saved_id;
  return query select saved_id, catalog_row.revision, saved_price, target_choices;
end;
$$;

revoke all on function public.save_package_catalog(text, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.save_package_selection(uuid, text, uuid, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.save_package_catalog(text, bigint, jsonb) to service_role;
grant execute on function public.save_package_selection(uuid, text, uuid, bigint, jsonb) to service_role;

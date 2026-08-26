create extension if not exists pgcrypto;

create type public.trip_role as enum ('owner', 'member');
create type public.drink_category as enum ('beer', 'wine', 'spirit', 'cocktail');
create type public.sync_entity_type as enum ('trip', 'participant', 'drink', 'drinkEntry', 'waterEntry');

create table public.trips (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 100),
  share_code text not null unique check (char_length(share_code) between 6 and 24),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  timezone text not null default 'Africa/Casablanca',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.trip_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table public.participants (
  id uuid primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  avatar_url text,
  color_index smallint not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.drinks (
  id uuid primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  category public.drink_category not null,
  icon text not null check (char_length(icon) between 1 and 16),
  is_alcohol boolean not null default true,
  is_system boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.drink_entries (
  id uuid primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  participant_id uuid not null references public.participants(id),
  drink_id uuid not null references public.drinks(id),
  consumed_at timestamptz not null,
  action_by uuid not null references auth.users(id),
  device_id uuid not null,
  round_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.water_entries (
  id uuid primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  participant_id uuid not null references public.participants(id),
  consumed_at timestamptz not null,
  action_by uuid not null references auth.users(id),
  device_id uuid not null,
  round_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.sync_operations (
  id text primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  entity_type public.sync_entity_type not null,
  entity_id uuid not null,
  user_id uuid not null references auth.users(id),
  applied_at timestamptz not null default now()
);

create index participants_trip_idx on public.participants (trip_id, deleted_at, sort_order);
create index drinks_trip_idx on public.drinks (trip_id, deleted_at, sort_order);
create index drink_entries_trip_time_idx on public.drink_entries (trip_id, consumed_at desc) where deleted_at is null;
create index drink_entries_participant_idx on public.drink_entries (participant_id, consumed_at desc) where deleted_at is null;
create index water_entries_trip_time_idx on public.water_entries (trip_id, consumed_at desc) where deleted_at is null;
create index sync_operations_trip_idx on public.sync_operations (trip_id, applied_at desc);

create or replace function public.is_trip_member(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.trip_members where trip_id = target_trip_id and user_id = auth.uid());
$$;

revoke all on function public.is_trip_member(uuid) from public;
grant execute on function public.is_trip_member(uuid) to authenticated;

create or replace function public.add_trip_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trip_members (trip_id, user_id, role) values (new.id, new.created_by, 'owner') on conflict do nothing;
  return new;
end;
$$;

create trigger trips_add_owner after insert on public.trips for each row execute function public.add_trip_owner();

create or replace function public.reject_stale_entity_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.updated_at < old.updated_at then return null; end if;
  return new;
end;
$$;

create trigger trips_reject_stale before update on public.trips for each row execute function public.reject_stale_entity_update();
create trigger participants_reject_stale before update on public.participants for each row execute function public.reject_stale_entity_update();
create trigger drinks_reject_stale before update on public.drinks for each row execute function public.reject_stale_entity_update();
create trigger drink_entries_reject_stale before update on public.drink_entries for each row execute function public.reject_stale_entity_update();
create trigger water_entries_reject_stale before update on public.water_entries for each row execute function public.reject_stale_entity_update();

create or replace function public.join_trip_by_code(p_share_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare target_trip_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select id into target_trip_id from public.trips where upper(share_code) = upper(trim(p_share_code)) and deleted_at is null;
  if target_trip_id is null then raise exception 'trip not found'; end if;
  insert into public.trip_members (trip_id, user_id, role) values (target_trip_id, auth.uid(), 'member') on conflict do nothing;
  return target_trip_id;
end;
$$;

revoke all on function public.join_trip_by_code(text) from public;
grant execute on function public.join_trip_by_code(text) to authenticated;

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.participants enable row level security;
alter table public.drinks enable row level security;
alter table public.drink_entries enable row level security;
alter table public.water_entries enable row level security;
alter table public.sync_operations enable row level security;

create policy trips_select on public.trips for select to authenticated using (public.is_trip_member(id));
create policy trips_insert on public.trips for insert to authenticated with check (created_by = auth.uid());
create policy trips_update on public.trips for update to authenticated using (public.is_trip_member(id)) with check (public.is_trip_member(id));
create policy trips_delete on public.trips for delete to authenticated using (public.is_trip_member(id));

create policy members_select on public.trip_members for select to authenticated using (public.is_trip_member(trip_id));
create policy members_insert on public.trip_members for insert to authenticated with check (user_id = auth.uid() and public.is_trip_member(trip_id));
create policy members_update on public.trip_members for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy members_delete on public.trip_members for delete to authenticated using (public.is_trip_member(trip_id));

create policy participants_select on public.participants for select to authenticated using (public.is_trip_member(trip_id));
create policy participants_insert on public.participants for insert to authenticated with check (public.is_trip_member(trip_id));
create policy participants_update on public.participants for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy participants_delete on public.participants for delete to authenticated using (public.is_trip_member(trip_id));

create policy drinks_select on public.drinks for select to authenticated using (public.is_trip_member(trip_id));
create policy drinks_insert on public.drinks for insert to authenticated with check (public.is_trip_member(trip_id));
create policy drinks_update on public.drinks for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy drinks_delete on public.drinks for delete to authenticated using (public.is_trip_member(trip_id));

create policy drink_entries_select on public.drink_entries for select to authenticated using (public.is_trip_member(trip_id));
create policy drink_entries_insert on public.drink_entries for insert to authenticated with check (public.is_trip_member(trip_id) and action_by = auth.uid());
create policy drink_entries_update on public.drink_entries for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy drink_entries_delete on public.drink_entries for delete to authenticated using (public.is_trip_member(trip_id));

create policy water_entries_select on public.water_entries for select to authenticated using (public.is_trip_member(trip_id));
create policy water_entries_insert on public.water_entries for insert to authenticated with check (public.is_trip_member(trip_id) and action_by = auth.uid());
create policy water_entries_update on public.water_entries for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy water_entries_delete on public.water_entries for delete to authenticated using (public.is_trip_member(trip_id));

create policy sync_operations_select on public.sync_operations for select to authenticated using (public.is_trip_member(trip_id));
create policy sync_operations_insert on public.sync_operations for insert to authenticated with check (public.is_trip_member(trip_id) and user_id = auth.uid());

grant select, insert, update, delete on all tables in schema public to authenticated;

alter table public.participants replica identity full;
alter table public.drinks replica identity full;
alter table public.drink_entries replica identity full;
alter table public.water_entries replica identity full;
alter publication supabase_realtime add table public.participants, public.drinks, public.drink_entries, public.water_entries;

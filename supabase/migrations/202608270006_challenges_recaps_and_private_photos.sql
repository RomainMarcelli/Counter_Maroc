-- Challenges, gages et souvenirs privés -----------------------------------
-- Les récaps restent calculés depuis les données brutes : aucune table de
-- snapshot n'est nécessaire pour dix jours et quelques centaines d'entrées.

-- Une base ancienne partiellement migrée peut avoir les tables historiques sans
-- les helpers de 0001/0004. 0006 les utilise pour ses triggers et policies : les
-- redéfinir ici avec leur forme canonique rend cette migration autonome, sans
-- toucher aux données ni changer les permissions d’une base saine.
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

create or replace function public.is_trip_member(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.trip_members
    where trip_id = target_trip_id and user_id = auth.uid()
  );
$$;

create or replace function public.participant_in_trip(p_participant_id uuid, p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.participants where id = p_participant_id and trip_id = p_trip_id);
$$;

revoke all on function public.is_trip_member(uuid) from public;
revoke all on function public.participant_in_trip(uuid, uuid) from public;
grant execute on function public.is_trip_member(uuid) to authenticated;
grant execute on function public.participant_in_trip(uuid, uuid) to authenticated;

create table public.challenges (
  id uuid primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  scope text not null check (scope in ('individual', 'group')),
  period text not null check (period in ('day', 'trip')),
  day_key date,
  target_type text not null check (target_type in ('manual', 'water_count', 'drink_variety', 'no_spirits', 'water_after_13', 'new_cocktail', 'water_between_drinks', 'full_round', 'group_photo', 'category_variety')),
  target_value integer not null default 1 check (target_value between 1 and 1000),
  participant_id uuid references public.participants(id) on delete set null,
  reward text check (char_length(reward) <= 300),
  status text not null default 'active' check (status in ('active', 'completed', 'failed')),
  completed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((period = 'day' and day_key is not null) or (period = 'trip' and day_key is null)),
  check ((scope = 'individual' and participant_id is not null) or scope = 'group')
);

create table public.forfeits (
  id uuid primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 500),
  participant_id uuid references public.participants(id) on delete set null,
  challenge_id uuid references public.challenges(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  completed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.trip_photos (
  id uuid primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  storage_path text not null unique check (storage_path ~ '^[0-9a-f-]{36}/'),
  taken_at timestamptz not null,
  uploaded_by uuid not null references auth.users(id),
  caption text check (char_length(caption) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index challenges_trip_idx on public.challenges (trip_id, deleted_at, period, day_key, status);
create index forfeits_trip_idx on public.forfeits (trip_id, deleted_at, status);
create index trip_photos_trip_time_idx on public.trip_photos (trip_id, taken_at desc) where deleted_at is null;

create trigger challenges_reject_stale before update on public.challenges for each row execute function public.reject_stale_entity_update();
create trigger forfeits_reject_stale before update on public.forfeits for each row execute function public.reject_stale_entity_update();
create trigger trip_photos_reject_stale before update on public.trip_photos for each row execute function public.reject_stale_entity_update();

create or replace function public.challenge_exists(p_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.challenges where id = p_id); $$;
create or replace function public.forfeit_exists(p_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.forfeits where id = p_id); $$;
create or replace function public.trip_photo_exists(p_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.trip_photos where id = p_id); $$;

revoke all on function public.challenge_exists(uuid) from public;
revoke all on function public.forfeit_exists(uuid) from public;
revoke all on function public.trip_photo_exists(uuid) from public;
grant execute on function public.challenge_exists(uuid) to authenticated;
grant execute on function public.forfeit_exists(uuid) to authenticated;
grant execute on function public.trip_photo_exists(uuid) to authenticated;

alter table public.challenges enable row level security;
alter table public.forfeits enable row level security;
alter table public.trip_photos enable row level security;

create policy challenges_select on public.challenges for select to authenticated using (public.is_trip_member(trip_id));
create policy challenges_insert on public.challenges for insert to authenticated with check (
  public.is_trip_member(trip_id) and (created_by = auth.uid() or public.challenge_exists(id))
  and (participant_id is null or public.participant_in_trip(participant_id, trip_id))
);
create policy challenges_update on public.challenges for update to authenticated using (public.is_trip_member(trip_id)) with check (
  public.is_trip_member(trip_id) and (participant_id is null or public.participant_in_trip(participant_id, trip_id))
);
create policy challenges_delete on public.challenges for delete to authenticated using (public.is_trip_member(trip_id));

create policy forfeits_select on public.forfeits for select to authenticated using (public.is_trip_member(trip_id));
create policy forfeits_insert on public.forfeits for insert to authenticated with check (
  public.is_trip_member(trip_id) and (created_by = auth.uid() or public.forfeit_exists(id))
  and (participant_id is null or public.participant_in_trip(participant_id, trip_id))
);
create policy forfeits_update on public.forfeits for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy forfeits_delete on public.forfeits for delete to authenticated using (public.is_trip_member(trip_id));

create policy trip_photos_select on public.trip_photos for select to authenticated using (public.is_trip_member(trip_id));
create policy trip_photos_insert on public.trip_photos for insert to authenticated with check (
  public.is_trip_member(trip_id) and (uploaded_by = auth.uid() or public.trip_photo_exists(id))
);
create policy trip_photos_update on public.trip_photos for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy trip_photos_delete on public.trip_photos for delete to authenticated using (public.is_trip_member(trip_id));

grant select, insert, update, delete on public.challenges, public.forfeits, public.trip_photos to authenticated;

alter table public.challenges replica identity full;
alter table public.forfeits replica identity full;
alter table public.trip_photos replica identity full;

do $$
declare v_table_name text;
begin
  foreach v_table_name in array array['challenges', 'forfeits', 'trip_photos'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table_name);
    end if;
  end loop;
end;
$$;

-- Storage privé ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 3145728, array['image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-photos', 'trip-photos', false, 6291456, array['image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

update public.participants
set avatar_url = 'storage:profile-photos/' || split_part(avatar_url, '/profile-photos/', 2), updated_at = now()
where avatar_url like '%/profile-photos/%' and avatar_url not like 'storage:%';

create or replace function public.storage_object_trip_id(object_name text)
returns uuid language plpgsql stable security definer set search_path = ''
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when invalid_text_representation then return null;
end;
$$;

revoke all on function public.storage_object_trip_id(text) from public;
grant execute on function public.storage_object_trip_id(text) to authenticated;

drop policy if exists profile_photos_select on storage.objects;
drop policy if exists profile_photos_insert on storage.objects;
drop policy if exists profile_photos_update on storage.objects;
drop policy if exists profile_photos_delete on storage.objects;

create policy profile_photos_select on storage.objects for select to authenticated using (
  bucket_id = 'profile-photos' and public.is_trip_member(public.storage_object_trip_id(name))
);
create policy profile_photos_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'profile-photos' and public.is_trip_member(public.storage_object_trip_id(name))
);
create policy profile_photos_update on storage.objects for update to authenticated using (
  bucket_id = 'profile-photos' and public.is_trip_member(public.storage_object_trip_id(name))
) with check (bucket_id = 'profile-photos' and public.is_trip_member(public.storage_object_trip_id(name)));
create policy profile_photos_delete on storage.objects for delete to authenticated using (
  bucket_id = 'profile-photos' and public.is_trip_member(public.storage_object_trip_id(name))
);

create policy trip_photos_storage_select on storage.objects for select to authenticated using (
  bucket_id = 'trip-photos' and public.is_trip_member(public.storage_object_trip_id(name))
);
create policy trip_photos_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'trip-photos' and public.is_trip_member(public.storage_object_trip_id(name))
);
create policy trip_photos_storage_update on storage.objects for update to authenticated using (
  bucket_id = 'trip-photos' and public.is_trip_member(public.storage_object_trip_id(name))
) with check (bucket_id = 'trip-photos' and public.is_trip_member(public.storage_object_trip_id(name)));
create policy trip_photos_storage_delete on storage.objects for delete to authenticated using (
  bucket_id = 'trip-photos' and public.is_trip_member(public.storage_object_trip_id(name))
);

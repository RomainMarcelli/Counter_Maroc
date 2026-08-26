-- Comptes email/mot de passe, identités de participants et RLS collaborative ---
--
-- Contexte : l’application s’appuyait sur `signInAnonymously()`. Le provider
-- anonyme a été désactivé sur le projet, donc plus aucun téléphone n’obtenait de
-- session `authenticated`. Sans session, `is_trip_member()` renvoyait toujours
-- false, `trips` et `trip_members` sont restés vides, et chaque écriture était
-- refusée par RLS :
--   new row violates row-level security policy for table "drinks"  (42501)
--
-- Cette migration remplace l’auth anonyme par de vrais comptes et rend le
-- membership du séjour fiable. RLS reste activée partout.
--
-- Règle métier : tout membre d’un séjour gère TOUTES les données de ce séjour.
-- Romain peut ajouter un verre à Lucas. On garde seulement l’auteur de l’action
-- dans `action_by` pour la traçabilité — l’auteur n’est pas forcément le buveur.

-- 1. Profils --------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Prénom affiché du compte. Alimenté à l’inscription, jamais exposé hors des séjours partagés.';

-- Le prénom saisi à l’inscription arrive dans raw_user_meta_data.display_name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Crew'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Comptes déjà créés avant cette migration (dont les anciens anonymes).
insert into public.profiles (id, display_name)
select
  users.id,
  coalesce(
    nullif(trim(users.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'Crew'
  )
from auth.users users
on conflict (id) do nothing;

-- 2. Lien compte ↔ participant --------------------------------------------
-- Un participant peut exister sans compte : quelqu’un ajoute « Lucas » avant que
-- Lucas installe l’application. Lucas s’y rattache ensuite avec claim_participant().

alter table public.participants
  add column if not exists user_id uuid references auth.users(id) on delete set null;

comment on column public.participants.user_id is 'Compte rattaché à ce participant. NULL tant que la personne n’a pas rejoint le séjour.';

-- Un compte ne tient qu’une seule identité par séjour.
create unique index if not exists participants_trip_user_idx
  on public.participants (trip_id, user_id)
  where user_id is not null and deleted_at is null;

-- Personne ne peut s’attribuer l’identité d’un autre compte.
create or replace function public.guard_participant_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Les migrations et le service_role n’ont pas de auth.uid() : on les laisse passer.
  if auth.uid() is null then return new; end if;

  if tg_op = 'INSERT' then
    if new.user_id is not null and new.user_id <> auth.uid() then
      raise exception 'cannot create a participant linked to another account' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id then
    if coalesce(old.user_id, new.user_id) <> auth.uid() then
      raise exception 'cannot change the account linked to this participant' using errcode = '42501';
    end if;
    if new.user_id is not null and new.user_id <> auth.uid() then
      raise exception 'cannot link a participant to another account' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists participants_guard_identity on public.participants;
create trigger participants_guard_identity
  before insert or update on public.participants
  for each row execute function public.guard_participant_identity();

-- 3. Fonctions de membership ----------------------------------------------

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

create or replace function public.is_trip_owner(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.trip_members
    where trip_id = target_trip_id and user_id = auth.uid() and role = 'owner'
  );
$$;

-- Cohérence d’un verre : le participant et la boisson appartiennent au séjour visé.
create or replace function public.participant_in_trip(p_participant_id uuid, p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.participants where id = p_participant_id and trip_id = p_trip_id);
$$;

create or replace function public.drink_in_trip(p_drink_id uuid, p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.drinks where id = p_drink_id and trip_id = p_trip_id);
$$;

revoke all on function public.is_trip_member(uuid) from public;
revoke all on function public.is_trip_owner(uuid) from public;
revoke all on function public.participant_in_trip(uuid, uuid) from public;
revoke all on function public.drink_in_trip(uuid, uuid) from public;
grant execute on function public.is_trip_member(uuid) to authenticated;
grant execute on function public.is_trip_owner(uuid) to authenticated;
grant execute on function public.participant_in_trip(uuid, uuid) to authenticated;
grant execute on function public.drink_in_trip(uuid, uuid) to authenticated;

-- 4. Création d’un séjour, en une transaction ------------------------------
-- Le trigger trips_add_owner ne suffisait pas : si l’INSERT du trip échouait, le
-- reste de la synchronisation continuait et se heurtait à un trip_members vide.
-- Ici trip + membership owner + participant réussissent ou échouent ensemble.
-- Les identifiants viennent du téléphone (offline-first) : rejouer l’appel est sans effet.

create or replace function public.create_trip_with_owner(
  p_trip_id uuid,
  p_name text,
  p_share_code text,
  p_start_date date,
  p_end_date date,
  p_timezone text,
  p_participant_id uuid,
  p_participant_name text,
  p_created_at timestamptz default now(),
  p_updated_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(trim(p_share_code));
  v_attempt integer := 0;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if exists (select 1 from public.trips where id = p_trip_id) then
    -- Rejeu : on ne touche pas à un séjour créé par quelqu’un d’autre.
    if not exists (select 1 from public.trips where id = p_trip_id and created_by = v_user) then
      raise exception 'trip identifier already used' using errcode = '42501';
    end if;
  else
    loop
      begin
        insert into public.trips (id, name, share_code, start_date, end_date, timezone, created_by, created_at, updated_at)
        values (p_trip_id, p_name, v_code, p_start_date, p_end_date, coalesce(nullif(p_timezone, ''), 'Africa/Casablanca'), v_user, p_created_at, p_updated_at);
        exit;
      exception when unique_violation then
        -- Collision de code de partage : on en tire un autre plutôt que d’échouer.
        v_attempt := v_attempt + 1;
        if v_attempt > 5 then raise; end if;
        v_code := upper(substr(v_code, 1, 8)) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
      end;
    end loop;
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (p_trip_id, v_user, 'owner')
  on conflict (trip_id, user_id) do update set role = 'owner';

  insert into public.participants (id, trip_id, name, user_id, color_index, sort_order, created_at, updated_at)
  values (p_participant_id, p_trip_id, p_participant_name, v_user, 0, 0, p_created_at, p_updated_at)
  on conflict (id) do nothing;

  return p_trip_id;
end;
$$;

revoke all on function public.create_trip_with_owner(uuid, text, text, date, date, text, uuid, text, timestamptz, timestamptz) from public;
grant execute on function public.create_trip_with_owner(uuid, text, text, date, date, text, uuid, text, timestamptz, timestamptz) to authenticated;

-- 5. Rejoindre un séjour ---------------------------------------------------
-- Idempotent : rejoindre deux fois ne produit pas d’erreur. Renvoie de quoi
-- afficher le séjour et proposer le choix du participant.

drop function if exists public.join_trip_by_code(text);

create or replace function public.join_trip_by_code(p_share_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_trip public.trips%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select * into v_trip
  from public.trips
  where upper(share_code) = upper(trim(p_share_code)) and deleted_at is null;

  if v_trip.id is null then
    raise exception 'trip not found' using errcode = 'P0002';
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (v_trip.id, v_user, 'member')
  on conflict (trip_id, user_id) do nothing;

  return jsonb_build_object('trip_id', v_trip.id, 'name', v_trip.name, 'share_code', v_trip.share_code);
end;
$$;

revoke all on function public.join_trip_by_code(text) from public;
grant execute on function public.join_trip_by_code(text) to authenticated;

-- 6. Choisir son participant ----------------------------------------------

create or replace function public.claim_participant(p_participant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_trip uuid;
  v_holder uuid;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select trip_id, user_id into v_trip, v_holder
  from public.participants
  where id = p_participant_id and deleted_at is null;

  if v_trip is null then
    raise exception 'participant not found' using errcode = 'P0002';
  end if;
  if not public.is_trip_member(v_trip) then
    raise exception 'not a trip member' using errcode = '42501';
  end if;
  if v_holder is not null and v_holder <> v_user then
    raise exception 'participant already claimed' using errcode = '42501';
  end if;

  -- Un compte ne tient qu’une identité par séjour : on libère la précédente.
  update public.participants
  set user_id = null, updated_at = now()
  where trip_id = v_trip and user_id = v_user and id <> p_participant_id;

  update public.participants
  set user_id = v_user, updated_at = now()
  where id = p_participant_id;

  return v_trip;
end;
$$;

revoke all on function public.claim_participant(uuid) from public;
grant execute on function public.claim_participant(uuid) to authenticated;

-- Liste des séjours du compte, pour rouvrir directement le bon séjour au lancement.
create or replace function public.my_trips()
returns table (trip_id uuid, name text, share_code text, role public.trip_role, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select trips.id, trips.name, trips.share_code, members.role, members.joined_at
  from public.trip_members members
  join public.trips trips on trips.id = members.trip_id
  where members.user_id = auth.uid() and trips.deleted_at is null
  order by members.joined_at desc;
$$;

revoke all on function public.my_trips() from public;
grant execute on function public.my_trips() to authenticated;

-- 7. Policies --------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;

-- Son propre profil, plus celui des personnes avec qui on partage un séjour.
create policy profiles_select on public.profiles for select to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.trip_members mine
    join public.trip_members theirs on theirs.trip_id = mine.trip_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  )
);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Trips : lecture et mise à jour par les membres, suppression réservée au owner.
drop policy if exists trips_select on public.trips;
drop policy if exists trips_insert on public.trips;
drop policy if exists trips_update on public.trips;
drop policy if exists trips_delete on public.trips;

create policy trips_select on public.trips for select to authenticated using (public.is_trip_member(id));
create policy trips_insert on public.trips for insert to authenticated with check (created_by = auth.uid());
create policy trips_update on public.trips for update to authenticated using (public.is_trip_member(id)) with check (public.is_trip_member(id));
create policy trips_delete on public.trips for delete to authenticated using (public.is_trip_owner(id));

-- Membres : on se voit entre membres ; on ne peut s’ajouter que soi-même, et
-- l’entrée dans un séjour passe par join_trip_by_code().
drop policy if exists members_select on public.trip_members;
drop policy if exists members_insert on public.trip_members;
drop policy if exists members_update on public.trip_members;
drop policy if exists members_delete on public.trip_members;

create policy members_select on public.trip_members for select to authenticated using (public.is_trip_member(trip_id));
create policy members_insert on public.trip_members for insert to authenticated with check (user_id = auth.uid() and public.is_trip_member(trip_id));
create policy members_update on public.trip_members for update to authenticated using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));
create policy members_delete on public.trip_members for delete to authenticated using (public.is_trip_owner(trip_id) or user_id = auth.uid());

-- Participants, boissons : tout membre du séjour gère la liste.
-- (le trigger participants_guard_identity protège la colonne user_id)
drop policy if exists participants_select on public.participants;
drop policy if exists participants_insert on public.participants;
drop policy if exists participants_update on public.participants;
drop policy if exists participants_delete on public.participants;

create policy participants_select on public.participants for select to authenticated using (public.is_trip_member(trip_id));
create policy participants_insert on public.participants for insert to authenticated with check (public.is_trip_member(trip_id));
create policy participants_update on public.participants for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy participants_delete on public.participants for delete to authenticated using (public.is_trip_member(trip_id));

drop policy if exists drinks_select on public.drinks;
drop policy if exists drinks_insert on public.drinks;
drop policy if exists drinks_update on public.drinks;
drop policy if exists drinks_delete on public.drinks;

create policy drinks_select on public.drinks for select to authenticated using (public.is_trip_member(trip_id));
create policy drinks_insert on public.drinks for insert to authenticated with check (public.is_trip_member(trip_id));
create policy drinks_update on public.drinks for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy drinks_delete on public.drinks for delete to authenticated using (public.is_trip_member(trip_id));

-- Consommations : un membre saisit pour N’IMPORTE QUEL participant du séjour.
-- Seul `action_by` est contraint à l’utilisateur connecté — c’est la traçabilité,
-- pas une restriction sur la personne qui a bu.
drop policy if exists drink_entries_select on public.drink_entries;
drop policy if exists drink_entries_insert on public.drink_entries;
drop policy if exists drink_entries_update on public.drink_entries;
drop policy if exists drink_entries_delete on public.drink_entries;

create policy drink_entries_select on public.drink_entries for select to authenticated
using (public.is_trip_member(trip_id));
create policy drink_entries_insert on public.drink_entries for insert to authenticated
with check (
  public.is_trip_member(trip_id)
  and action_by = auth.uid()
  and public.participant_in_trip(participant_id, trip_id)
  and public.drink_in_trip(drink_id, trip_id)
);
create policy drink_entries_update on public.drink_entries for update to authenticated
using (public.is_trip_member(trip_id))
with check (
  public.is_trip_member(trip_id)
  and public.participant_in_trip(participant_id, trip_id)
  and public.drink_in_trip(drink_id, trip_id)
);
create policy drink_entries_delete on public.drink_entries for delete to authenticated
using (public.is_trip_member(trip_id));

drop policy if exists water_entries_select on public.water_entries;
drop policy if exists water_entries_insert on public.water_entries;
drop policy if exists water_entries_update on public.water_entries;
drop policy if exists water_entries_delete on public.water_entries;

create policy water_entries_select on public.water_entries for select to authenticated
using (public.is_trip_member(trip_id));
create policy water_entries_insert on public.water_entries for insert to authenticated
with check (
  public.is_trip_member(trip_id)
  and action_by = auth.uid()
  and public.participant_in_trip(participant_id, trip_id)
);
create policy water_entries_update on public.water_entries for update to authenticated
using (public.is_trip_member(trip_id))
with check (public.is_trip_member(trip_id) and public.participant_in_trip(participant_id, trip_id));
create policy water_entries_delete on public.water_entries for delete to authenticated
using (public.is_trip_member(trip_id));

grant select, insert, update, delete on public.profiles to authenticated;

-- 8. Realtime --------------------------------------------------------------
-- `trips` manquait à la publication : un changement de nom de séjour ne partait
-- sur aucun téléphone alors que le client y était abonné.

alter table public.trips replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trips'
  ) then
    execute 'alter publication supabase_realtime add table public.trips';
  end if;
end;
$$;

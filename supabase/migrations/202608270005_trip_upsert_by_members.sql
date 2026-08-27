-- Les membres doivent pouvoir resynchroniser ce qu’ils ont le droit de modifier --
--
-- Un `upsert` PostgREST est un `INSERT ... ON CONFLICT (id) DO UPDATE`. PostgreSQL
-- évalue le WITH CHECK de la policy d’INSERTION sur la ligne proposée **avant** de
-- détecter le conflit. Une policy d’insertion pensée pour la création s’appliquait
-- donc aussi à chaque mise à jour venue de la file de synchronisation :
--
--   POST /rest/v1/trips?on_conflict=id         → 42501
--   POST /rest/v1/drink_entries?on_conflict=id → 42501
--
-- alors que les policies UPDATE, elles, autorisaient parfaitement l’opération. La
-- conséquence était visible : Lucas ne pouvait ni corriger ni supprimer une
-- consommation saisie par Romain, ce qui contredit la règle du produit — tout
-- membre gère toutes les données de son séjour.
--
-- Correction : on autorise le chemin d’insertion quand la ligne existe déjà, ce qui
-- rend la contrainte de création inopérante sur un simple rejeu. Aucune permission
-- nouvelle n’est accordée : ces mises à jour étaient déjà permises par les policies
-- UPDATE. Pour une ligne réellement neuve, la contrainte d’origine s’applique
-- toujours intégralement.

-- La policy d’une table ne peut pas interroger cette même table sans récursion :
-- ces sondes passent donc par des fonctions `security definer`.

create or replace function public.trip_exists(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.trips where id = p_id);
$$;

create or replace function public.drink_entry_exists(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.drink_entries where id = p_id);
$$;

create or replace function public.water_entry_exists(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.water_entries where id = p_id);
$$;

revoke all on function public.trip_exists(uuid) from public;
revoke all on function public.drink_entry_exists(uuid) from public;
revoke all on function public.water_entry_exists(uuid) from public;
grant execute on function public.trip_exists(uuid) to authenticated;
grant execute on function public.drink_entry_exists(uuid) to authenticated;
grant execute on function public.water_entry_exists(uuid) to authenticated;

-- Séjour : créer exige d’en être l’auteur ; resynchroniser exige d’en être membre.

drop policy if exists trips_insert on public.trips;

create policy trips_insert on public.trips for insert to authenticated
with check (
  created_by = auth.uid()
  or (public.trip_exists(id) and public.is_trip_member(id))
);

-- Consommations : `action_by = auth.uid()` reste exigé à la création, pour la
-- traçabilité. Sur une ligne déjà enregistrée, l’auteur d’origine est conservé tel
-- quel — c’est précisément ce que le téléphone renvoie.

drop policy if exists drink_entries_insert on public.drink_entries;

create policy drink_entries_insert on public.drink_entries for insert to authenticated
with check (
  public.is_trip_member(trip_id)
  and (action_by = auth.uid() or public.drink_entry_exists(id))
  and public.participant_in_trip(participant_id, trip_id)
  and public.drink_in_trip(drink_id, trip_id)
);

drop policy if exists water_entries_insert on public.water_entries;

create policy water_entries_insert on public.water_entries for insert to authenticated
with check (
  public.is_trip_member(trip_id)
  and (action_by = auth.uid() or public.water_entry_exists(id))
  and public.participant_in_trip(participant_id, trip_id)
);

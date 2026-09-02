-- Réparation de schéma, idempotente ---------------------------------------
--
-- Une base migrée à la main peut avoir perdu des fonctions utilitaires posées
-- par les premières migrations : l'application de 202608270006 a pu échouer sur
-- « reject_stale_entity_update() does not exist ».
--
-- Ce fichier redéfinit uniquement les helpers communs. Il ne crée
-- aucune table, ne touche à aucune donnée, ne modifie aucune migration
-- existante, et peut être rejoué autant de fois que nécessaire — y compris sur
-- une base parfaitement à jour, où il ne changera rien.
--
-- Son nom est volontairement un timestamp numérique reconnu par la CLI.
-- La migration 0006 redéfinit au préalable les helpers dont elle dépend ; ce
-- filet idempotent vérifie ensuite le jeu complet, notamment `is_trip_owner`.

-- Refuse une écriture plus ancienne que la ligne déjà en base : c'est ce qui
-- protège la synchronisation quand deux téléphones poussent le même objet.
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
revoke all on function public.is_trip_owner(uuid) from public;
revoke all on function public.participant_in_trip(uuid, uuid) from public;
grant execute on function public.is_trip_member(uuid) to authenticated;
grant execute on function public.is_trip_owner(uuid) to authenticated;
grant execute on function public.participant_in_trip(uuid, uuid) to authenticated;

-- Les déclencheurs des tables historiques sont recréés seulement s'ils manquent :
-- une base saine ne bouge pas.
do $$
declare v_table text;
begin
  foreach v_table in array array['trips', 'participants', 'drinks', 'drink_entries', 'water_entries'] loop
    if to_regclass('public.' || v_table) is not null
      and not exists (
        select 1 from pg_trigger
        where tgrelid = ('public.' || v_table)::regclass
          and tgname = v_table || '_reject_stale'
          and not tgisinternal
      )
    then
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.reject_stale_entity_update()',
        v_table || '_reject_stale', v_table
      );
    end if;
  end loop;
end;
$$;

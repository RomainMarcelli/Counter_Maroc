-- Convergence déterministe lors d'un timestamp identique ------------------
--
-- Deux appareils peuvent produire le même `updated_at` à la milliseconde.
-- L'ancienne fonction acceptait alors les deux variantes ; selon l'ordre des
-- événements Realtime, chaque téléphone pouvait conserver la sienne.
--
-- Règle : PostgreSQL conserve la première écriture reçue quand le timestamp est
-- identique. Les clients considèrent ensuite la ligne serveur égale comme
-- autoritaire. Pour des timestamps distincts, la version la plus récente gagne
-- comme auparavant. Remplacer la fonction met à jour tous ses triggers existants.

create or replace function public.reject_stale_entity_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.updated_at <= old.updated_at then return null; end if;
  return new;
end;
$$;

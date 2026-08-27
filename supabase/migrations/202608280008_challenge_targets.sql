-- Nouveaux types d'objectif pour les challenges ---------------------------
--
-- La bibliothèque gagne des défis orientés découverte et variété. Le schéma de
-- 202608270006 n'est pas modifié : seule sa contrainte de validation est
-- élargie ici, de façon idempotente.
--
-- À EXÉCUTER APRÈS 202608270006.

do $$
declare v_constraint text;
begin
  if to_regclass('public.challenges') is null then
    raise exception 'La table public.challenges est absente : exécutez d''abord 202608270006.';
  end if;

  -- La contrainte porte un nom généré par PostgreSQL : on la retrouve par sa définition.
  select conname into v_constraint
  from pg_constraint
  where conrelid = 'public.challenges'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%target_type%';

  if v_constraint is not null then
    execute format('alter table public.challenges drop constraint %I', v_constraint);
  end if;

  alter table public.challenges add constraint challenges_target_type_check check (
    target_type in (
      'manual', 'water_count', 'drink_variety', 'no_spirits', 'water_after_13',
      'new_cocktail', 'water_between_drinks', 'full_round', 'group_photo', 'category_variety',
      'cocktail_variety', 'new_drink', 'all_categories', 'other_favorite',
      'signature_drink', 'own_favorite', 'different_from_yesterday', 'same_cocktail_round'
    )
  );
end;
$$;

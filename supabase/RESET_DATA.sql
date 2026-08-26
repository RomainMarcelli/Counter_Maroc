-- MARRAKECH CREW — REMISE À ZÉRO DES DONNÉES
--
-- ATTENTION : ce script supprime définitivement tous les séjours et toutes
-- leurs données dans le projet Supabase courant. Il conserve le schéma,
-- les migrations, les policies RLS et les utilisateurs Supabase Auth.
-- Les fichiers du bucket Storage `profile-photos` ne sont pas supprimés par
-- cette requête : utilisez Storage > profile-photos pour les effacer aussi.
--
-- À exécuter volontairement dans Supabase > SQL Editor.

begin;

truncate table
  public.sync_operations,
  public.water_entries,
  public.drink_entries,
  public.drinks,
  public.participants,
  public.trip_members,
  public.trips
restart identity cascade;

commit;

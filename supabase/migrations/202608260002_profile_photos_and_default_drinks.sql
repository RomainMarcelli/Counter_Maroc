-- Photos de profil ----------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.profile_photo_trip_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception
  when invalid_text_representation then return null;
end;
$$;

revoke all on function public.profile_photo_trip_id(text) from public;
grant execute on function public.profile_photo_trip_id(text) to authenticated;

create policy profile_photos_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'profile-photos'
  and public.is_trip_member(public.profile_photo_trip_id(name))
);

create policy profile_photos_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and public.is_trip_member(public.profile_photo_trip_id(name))
);

create policy profile_photos_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-photos'
  and public.is_trip_member(public.profile_photo_trip_id(name))
)
with check (
  bucket_id = 'profile-photos'
  and public.is_trip_member(public.profile_photo_trip_id(name))
);

create policy profile_photos_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-photos'
  and public.is_trip_member(public.profile_photo_trip_id(name))
);

-- Boissons par défaut -------------------------------------------------------
-- Les séjours déjà présents sont complétés sans dupliquer un nom existant.
-- Les nouveaux séjours reçoivent la même liste immédiatement côté application,
-- puis celle-ci est synchronisée dans public.drinks.

with default_drinks(name, category, icon, sort_order) as (
  values
    ('Bière locale', 'beer', '🍺', 0),
    ('Casablanca', 'beer', '🍺', 1),
    ('Flag Spéciale', 'beer', '🍺', 2),
    ('Stork', 'beer', '🍺', 3),
    ('Vin rouge', 'wine', '🍷', 4),
    ('Vin blanc', 'wine', '🥂', 5),
    ('Vin rosé', 'wine', '🍷', 6),
    ('Vin gris', 'wine', '🥂', 7),
    ('Gin', 'spirit', '🍸', 8),
    ('Whisky', 'spirit', '🥃', 9),
    ('Vodka', 'spirit', '🧊', 10),
    ('Rhum blanc', 'spirit', '🥃', 11),
    ('Rhum ambré', 'spirit', '🥃', 12),
    ('Tequila', 'spirit', '🍋', 13),
    ('Pastis', 'spirit', '🧊', 14),
    ('Mojito', 'cocktail', '🌿', 15),
    ('Piña Colada', 'cocktail', '🍍', 16),
    ('Sex on the Beach', 'cocktail', '🍹', 17),
    ('Marrakech', 'cocktail', '🍹', 18),
    ('Gin Tonic', 'cocktail', '🍸', 19),
    ('Cuba Libre', 'cocktail', '🍹', 20),
    ('Margarita', 'cocktail', '🍸', 21),
    ('Spritz', 'cocktail', '🍹', 22),
    ('Punch', 'cocktail', '🍹', 23),
    ('Vodka Orange', 'cocktail', '🍊', 24)
)
insert into public.drinks (
  id,
  trip_id,
  name,
  category,
  icon,
  is_alcohol,
  is_system,
  sort_order
)
select
  gen_random_uuid(),
  trip.id,
  default_drinks.name,
  default_drinks.category::public.drink_category,
  default_drinks.icon,
  true,
  true,
  coalesce((select max(existing.sort_order) + 1 from public.drinks existing where existing.trip_id = trip.id), 0)
    + default_drinks.sort_order
from public.trips trip
cross join default_drinks
where trip.deleted_at is null
  and not exists (
    select 1
    from public.drinks existing
    where existing.trip_id = trip.id
      and lower(existing.name) = lower(default_drinks.name)
  );

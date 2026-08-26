-- Estimation d’alcoolémie et addition du séjour ------------------------------
--
-- Aucune table n’est créée : on étend des tables déjà protégées par RLS
-- (participants, drinks, drink_entries). Les policies existantes réservent donc
-- automatiquement ces nouvelles colonnes aux membres du séjour concerné.
--
-- Le poids et le coefficient de répartition sont des données personnelles :
-- ils restent facultatifs, restent dans le séjour, et le participant peut les
-- effacer ou désactiver l’estimation à tout moment. Aucune valeur d’alcoolémie
-- n’est stockée : le taux est toujours recalculé depuis les consommations.

-- Profil d’estimation du participant ----------------------------------------

alter table public.participants
  add column if not exists bac_estimation_enabled boolean not null default false,
  add column if not exists weight_kg numeric(5, 1),
  add column if not exists distribution_ratio numeric(4, 3),
  add column if not exists bac_private boolean not null default false;

alter table public.participants
  add constraint participants_weight_kg_check check (weight_kg is null or (weight_kg >= 30 and weight_kg <= 250)),
  add constraint participants_distribution_ratio_check check (distribution_ratio is null or (distribution_ratio >= 0.45 and distribution_ratio <= 0.8));

comment on column public.participants.weight_kg is 'Poids déclaré, facultatif, utilisé uniquement pour l’estimation théorique d’alcoolémie.';
comment on column public.participants.distribution_ratio is 'Coefficient de répartition de Widmark. Seul ce nombre est stocké, jamais de donnée corporelle.';
comment on column public.participants.bac_private is 'Le participant demande que son estimation ne soit affichée que sur son téléphone.';

-- Composition et prix des boissons ------------------------------------------

alter table public.drinks
  add column if not exists serving_volume_ml numeric(6, 1),
  add column if not exists abv_percent numeric(4, 1),
  add column if not exists alcohol_components jsonb,
  add column if not exists composition_confirmed boolean not null default false,
  add column if not exists price_cents integer;

alter table public.drinks
  add constraint drinks_serving_volume_check check (serving_volume_ml is null or (serving_volume_ml > 0 and serving_volume_ml <= 5000)),
  add constraint drinks_abv_percent_check check (abv_percent is null or (abv_percent >= 0 and abv_percent <= 100)),
  add constraint drinks_price_cents_check check (price_cents is null or price_cents >= 0),
  add constraint drinks_alcohol_components_check check (alcohol_components is null or jsonb_typeof(alcohol_components) = 'array');

comment on column public.drinks.alcohol_components is 'Alcools de la recette : [{"name","volumeMl","abvPercent"}]. Un cocktail n’est jamais calculé sur son volume total.';
comment on column public.drinks.composition_confirmed is 'false tant que le crew n’a pas validé la dose réellement servie au bar.';

-- Snapshot porté par chaque consommation ------------------------------------

alter table public.drink_entries
  add column if not exists alcohol_grams numeric(7, 3),
  add column if not exists drink_name_snapshot text,
  add column if not exists paid_by uuid references public.participants(id),
  add column if not exists price_cents_snapshot integer;

alter table public.drink_entries
  add constraint drink_entries_alcohol_grams_check check (alcohol_grams is null or alcohol_grams >= 0),
  add constraint drink_entries_price_cents_check check (price_cents_snapshot is null or price_cents_snapshot >= 0);

comment on column public.drink_entries.alcohol_grams is 'Alcool pur au moment du verre. Modifier une recette plus tard ne réécrit pas l’historique.';

create index if not exists drink_entries_paid_by_idx on public.drink_entries (paid_by) where deleted_at is null;

-- Compositions par défaut des boissons livrées avec l’application ------------
-- Ordres de grandeur volontairement marqués « à confirmer » : le séjour ajuste
-- les doses réellement servies depuis les Réglages.

with defaults(name, serving_volume_ml, abv_percent, alcohol_components) as (
  values
    ('Bière locale', 250, 5, null::jsonb),
    ('Casablanca', 250, 5, null::jsonb),
    ('Flag Spéciale', 250, 5, null::jsonb),
    ('Stork', 250, 5, null::jsonb),
    ('Vin rouge', 120, 13, null::jsonb),
    ('Vin blanc', 120, 12, null::jsonb),
    ('Vin rosé', 120, 12, null::jsonb),
    ('Vin gris', 120, 12, null::jsonb),
    ('Gin', 40, 40, null::jsonb),
    ('Whisky', 40, 40, null::jsonb),
    ('Vodka', 40, 40, null::jsonb),
    ('Rhum blanc', 40, 40, null::jsonb),
    ('Rhum ambré', 40, 40, null::jsonb),
    ('Tequila', 40, 38, null::jsonb),
    ('Pastis', 20, 45, null::jsonb),
    ('Mojito', 250, null, '[{"name":"Rhum blanc","volumeMl":40,"abvPercent":40}]'::jsonb),
    ('Piña Colada', 250, null, '[{"name":"Rhum blanc","volumeMl":40,"abvPercent":40}]'::jsonb),
    ('Sex on the Beach', 250, null, '[{"name":"Vodka","volumeMl":40,"abvPercent":40},{"name":"Liqueur de pêche","volumeMl":20,"abvPercent":20}]'::jsonb),
    ('Marrakech', 250, null, '[{"name":"Gin","volumeMl":40,"abvPercent":40}]'::jsonb),
    ('Gin Tonic', 250, null, '[{"name":"Gin","volumeMl":40,"abvPercent":40}]'::jsonb),
    ('Cuba Libre', 250, null, '[{"name":"Rhum ambré","volumeMl":40,"abvPercent":40}]'::jsonb),
    ('Margarita', 150, null, '[{"name":"Tequila","volumeMl":40,"abvPercent":38},{"name":"Triple sec","volumeMl":20,"abvPercent":30}]'::jsonb),
    ('Spritz', 200, null, '[{"name":"Apérol","volumeMl":60,"abvPercent":11},{"name":"Prosecco","volumeMl":90,"abvPercent":11}]'::jsonb),
    ('Punch', 200, null, '[{"name":"Rhum ambré","volumeMl":40,"abvPercent":40}]'::jsonb),
    ('Vodka Orange', 250, null, '[{"name":"Vodka","volumeMl":40,"abvPercent":40}]'::jsonb)
)
update public.drinks
set serving_volume_ml = defaults.serving_volume_ml,
    abv_percent = defaults.abv_percent,
    alcohol_components = defaults.alcohol_components
from defaults
where lower(public.drinks.name) = lower(defaults.name)
  and public.drinks.serving_volume_ml is null
  and public.drinks.alcohol_components is null;

-- Intégrité des références des nouvelles tables ---------------------------
--
-- Les policies de 0006 protégeaient déjà la lecture et le bucket Storage,
-- mais deux références pouvaient rester incohérentes sans donner accès aux
-- données : un gage de A vers un challenge de B, ou une métadonnée photo de A
-- vers un chemin préfixé par B. On refuse désormais ces lignes à l’écriture.

create or replace function public.challenge_in_trip(p_challenge_id uuid, p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.challenges where id = p_challenge_id and trip_id = p_trip_id);
$$;

revoke all on function public.challenge_in_trip(uuid, uuid) from public;
grant execute on function public.challenge_in_trip(uuid, uuid) to authenticated;

drop policy if exists forfeits_insert on public.forfeits;
create policy forfeits_insert on public.forfeits for insert to authenticated with check (
  public.is_trip_member(trip_id)
  and (created_by = auth.uid() or public.forfeit_exists(id))
  and (participant_id is null or public.participant_in_trip(participant_id, trip_id))
  and (challenge_id is null or public.challenge_in_trip(challenge_id, trip_id))
);

drop policy if exists forfeits_update on public.forfeits;
create policy forfeits_update on public.forfeits for update to authenticated
using (public.is_trip_member(trip_id))
with check (
  public.is_trip_member(trip_id)
  and (participant_id is null or public.participant_in_trip(participant_id, trip_id))
  and (challenge_id is null or public.challenge_in_trip(challenge_id, trip_id))
);

drop policy if exists trip_photos_insert on public.trip_photos;
create policy trip_photos_insert on public.trip_photos for insert to authenticated with check (
  public.is_trip_member(trip_id)
  and public.storage_object_trip_id(storage_path) = trip_id
  and (uploaded_by = auth.uid() or public.trip_photo_exists(id))
);

drop policy if exists trip_photos_update on public.trip_photos;
create policy trip_photos_update on public.trip_photos for update to authenticated
using (public.is_trip_member(trip_id))
with check (
  public.is_trip_member(trip_id)
  and public.storage_object_trip_id(storage_path) = trip_id
);

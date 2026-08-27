import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Vérification des policies contre le vrai projet Supabase, avec de vraies
 * sessions `authenticated`. Une policy ne se teste pas en lisant le SQL : elle se
 * teste en essayant d’écrire.
 *
 * Prérequis : la migration 202608260004 est appliquée, puis
 *   SUPABASE_RLS_TEST=1 npm run test:rls
 * Les comptes et le séjour créés ici sont supprimés à la fin.
 */
const ENABLED = process.env.SUPABASE_RLS_TEST === "1";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const uuid = () => crypto.randomUUID();
const stamp = Date.now();
const PASSWORD = "crew-rls-test-2026";
const ACCOUNTS = {
  romain: { email: `rls-romain-${stamp}@marrakech-crew.test`, name: "Romain" },
  lucas: { email: `rls-lucas-${stamp}@marrakech-crew.test`, name: "Lucas" },
  intrus: { email: `rls-intrus-${stamp}@marrakech-crew.test`, name: "Intrus" },
};

type Session = { client: SupabaseClient; userId: string };

let admin: SupabaseClient;
let romain: Session;
let lucas: Session;
let intrus: Session;
let tripId: string;
let shareCode: string;
let lucasParticipantId: string;
let otherTripId: string;
let otherParticipantId: string;
const createdUserIds: string[] = [];

async function openAccount(account: { email: string; name: string }): Promise<Session> {
  const { data, error } = await admin.auth.admin.createUser({
    email: account.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: account.name },
  });
  if (error) throw error;
  createdUserIds.push(data.user.id);
  const client = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email: account.email, password: PASSWORD });
  if (signInError) throw signInError;
  return { client, userId: data.user.id };
}

async function createTripFor(session: Session, name: string): Promise<{ tripId: string; shareCode: string; participantId: string }> {
  const id = uuid();
  const participantId = uuid();
  const code = `RLS${stamp.toString().slice(-5)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const { error } = await session.client.rpc("create_trip_with_owner", {
    p_trip_id: id,
    p_name: name,
    p_share_code: code,
    p_start_date: "2026-09-07",
    p_end_date: "2026-09-16",
    p_timezone: "Africa/Casablanca",
    p_participant_id: participantId,
    p_participant_name: "Créateur",
  });
  if (error) throw error;
  return { tripId: id, shareCode: code, participantId };
}

const suite = ENABLED ? describe : describe.skip;

beforeAll(async () => {
  if (!ENABLED) return;
  if (!URL || !ANON || !SERVICE) throw new Error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY et SUPABASE_SECRET_KEY sont requis.");
  admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  romain = await openAccount(ACCOUNTS.romain);
  lucas = await openAccount(ACCOUNTS.lucas);
  intrus = await openAccount(ACCOUNTS.intrus);

  const trip = await createTripFor(romain, "Marrakech RLS");
  tripId = trip.tripId;
  shareCode = trip.shareCode;

  const other = await createTripFor(intrus, "Séjour voisin");
  otherTripId = other.tripId;
  otherParticipantId = other.participantId;

  // Lucas rejoint, puis choisit son participant.
  const { error: joinError } = await lucas.client.rpc("join_trip_by_code", { p_share_code: shareCode });
  if (joinError) throw joinError;
  lucasParticipantId = uuid();
  const { error: participantError } = await lucas.client.from("participants").insert({
    id: lucasParticipantId, trip_id: tripId, name: "Lucas", color_index: 1, sort_order: 1,
  });
  if (participantError) throw participantError;
  const { error: claimError } = await lucas.client.rpc("claim_participant", { p_participant_id: lucasParticipantId });
  if (claimError) throw claimError;
}, 90_000);

afterAll(async () => {
  if (!ENABLED || !admin) return;
  if (tripId) await admin.from("trips").delete().eq("id", tripId);
  if (otherTripId) await admin.from("trips").delete().eq("id", otherTripId);
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
}, 90_000);

suite("un membre du séjour", () => {
  it("peut ajouter une boisson", async () => {
    const { error } = await romain.client.from("drinks").insert({
      id: uuid(), trip_id: tripId, name: "Gin Tonic RLS", category: "cocktail", icon: "🍸",
    });
    expect(error).toBeNull();
  });

  it("peut ajouter un verre à un AUTRE participant que lui", async () => {
    const drinkId = uuid();
    await romain.client.from("drinks").insert({ id: drinkId, trip_id: tripId, name: "Mojito RLS", category: "cocktail", icon: "🌿" });

    // Romain saisit pour Lucas : c’est le cœur du produit, ce doit être autorisé.
    const { error } = await romain.client.from("drink_entries").insert({
      id: uuid(), trip_id: tripId, participant_id: lucasParticipantId, drink_id: drinkId,
      consumed_at: new Date().toISOString(), action_by: romain.userId, device_id: uuid(),
    });
    expect(error).toBeNull();
  });

  it("peut resynchroniser le séjour sans en être le créateur", async () => {
    // Un upsert PostgREST reste un INSERT ... ON CONFLICT : PostgreSQL évalue le
    // WITH CHECK de la policy d’insertion sur la ligne proposée, `created_by`
    // compris. Sans la migration 0005, Lucas se prenait un 42501 sur /trips.
    const { error } = await lucas.client.from("trips").upsert({
      id: tripId, name: "Marrakech RLS", share_code: shareCode,
      start_date: "2026-09-07", end_date: "2026-09-16", timezone: "Africa/Casablanca",
      created_by: romain.userId, updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    expect(error).toBeNull();
  });

  it("ne peut pas créer un séjour au nom de quelqu’un d’autre", async () => {
    const { error } = await lucas.client.from("trips").insert({
      id: uuid(), name: "Usurpation", share_code: `USURP-${stamp}`,
      start_date: "2026-09-07", end_date: "2026-09-16", created_by: romain.userId,
    });
    expect(error?.code).toBe("42501");
  });

  it("peut corriger puis supprimer une consommation saisie par quelqu’un d’autre", async () => {
    const drinkId = uuid();
    const entryId = uuid();
    await romain.client.from("drinks").insert({ id: drinkId, trip_id: tripId, name: "À corriger", category: "beer", icon: "🍺" });
    await romain.client.from("drink_entries").insert({
      id: entryId, trip_id: tripId, participant_id: lucasParticipantId, drink_id: drinkId,
      consumed_at: new Date().toISOString(), action_by: romain.userId, device_id: uuid(),
    });

    // Lucas renvoie la ligne telle que la file la porte : l’auteur reste Romain.
    const row = {
      id: entryId, trip_id: tripId, participant_id: lucasParticipantId, drink_id: drinkId,
      consumed_at: new Date().toISOString(), action_by: romain.userId, device_id: uuid(),
      updated_at: new Date().toISOString(),
    };
    const corrected = await lucas.client.from("drink_entries").upsert(row, { onConflict: "id" });
    expect(corrected.error).toBeNull();

    const removed = await lucas.client.from("drink_entries")
      .upsert({ ...row, updated_at: new Date().toISOString(), deleted_at: new Date().toISOString() }, { onConflict: "id" });
    expect(removed.error).toBeNull();
  });

  it("ne peut pas créer une consommation signée par quelqu’un d’autre", async () => {
    const drinkId = uuid();
    await romain.client.from("drinks").insert({ id: drinkId, trip_id: tripId, name: "Signature", category: "beer", icon: "🍺" });

    // Ligne neuve : la contrainte de traçabilité s’applique pleinement.
    const { error } = await lucas.client.from("drink_entries").upsert({
      id: uuid(), trip_id: tripId, participant_id: lucasParticipantId, drink_id: drinkId,
      consumed_at: new Date().toISOString(), action_by: romain.userId, device_id: uuid(),
    }, { onConflict: "id" });
    expect(error?.code).toBe("42501");
  });

  it("voit les verres saisis par les autres membres", async () => {
    const { data, error } = await lucas.client.from("drink_entries").select("id").eq("trip_id", tripId);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("ne peut pas signer un verre au nom d’un autre compte", async () => {
    const drinkId = uuid();
    await romain.client.from("drinks").insert({ id: drinkId, trip_id: tripId, name: "Faux auteur", category: "beer", icon: "🍺" });

    const { error } = await romain.client.from("drink_entries").insert({
      id: uuid(), trip_id: tripId, participant_id: lucasParticipantId, drink_id: drinkId,
      consumed_at: new Date().toISOString(), action_by: lucas.userId, device_id: uuid(),
    });
    expect(error?.code).toBe("42501");
  });

  it("ne peut pas mélanger un participant d’un autre séjour", async () => {
    const drinkId = uuid();
    await romain.client.from("drinks").insert({ id: drinkId, trip_id: tripId, name: "Croisement", category: "beer", icon: "🍺" });

    const { error } = await romain.client.from("drink_entries").insert({
      id: uuid(), trip_id: tripId, participant_id: otherParticipantId, drink_id: drinkId,
      consumed_at: new Date().toISOString(), action_by: romain.userId, device_id: uuid(),
    });
    expect(error?.code).toBe("42501");
  });
});

suite("un utilisateur extérieur", () => {
  it("ne voit pas le séjour", async () => {
    const { data, error } = await intrus.client.from("trips").select("id").eq("id", tripId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("ne voit ni les participants ni les consommations", async () => {
    const participants = await intrus.client.from("participants").select("id").eq("trip_id", tripId);
    const entries = await intrus.client.from("drink_entries").select("id").eq("trip_id", tripId);
    expect(participants.data).toEqual([]);
    expect(entries.data).toEqual([]);
  });

  it("ne peut pas ajouter de boisson", async () => {
    const { error } = await intrus.client.from("drinks").insert({
      id: uuid(), trip_id: tripId, name: "Intrusion", category: "beer", icon: "🍺",
    });
    expect(error?.code).toBe("42501");
  });

  it("ne peut pas ajouter de consommation", async () => {
    const { error } = await intrus.client.from("drink_entries").insert({
      id: uuid(), trip_id: tripId, participant_id: lucasParticipantId, drink_id: uuid(),
      consumed_at: new Date().toISOString(), action_by: intrus.userId, device_id: uuid(),
    });
    expect(error?.code).toBe("42501");
  });

  it("ne peut pas s’ajouter lui-même aux membres", async () => {
    const { error } = await intrus.client.from("trip_members").insert({ trip_id: tripId, user_id: intrus.userId, role: "member" });
    expect(error?.code).toBe("42501");
  });
});

suite("identités", () => {
  it("refuse de prendre un participant déjà rattaché à un autre compte", async () => {
    const { error } = await romain.client.rpc("claim_participant", { p_participant_id: lucasParticipantId });
    expect(error?.message).toMatch(/already claimed/);
  });

  it("laisse rejoindre deux fois sans erreur", async () => {
    const { error } = await lucas.client.rpc("join_trip_by_code", { p_share_code: shareCode });
    expect(error).toBeNull();
  });

  it("refuse un code de partage inconnu", async () => {
    const { error } = await lucas.client.rpc("join_trip_by_code", { p_share_code: "AUCUN-CODE" });
    expect(error?.message).toMatch(/trip not found/);
  });

  it("ne laisse pas un membre rattacher un participant à un autre compte", async () => {
    const orphelin = uuid();
    await romain.client.from("participants").insert({ id: orphelin, trip_id: tripId, name: "Théo", color_index: 2, sort_order: 2 });

    const { error } = await romain.client.from("participants").update({ user_id: lucas.userId }).eq("id", orphelin);
    expect(error?.code).toBe("42501");
  });

  it("expose le séjour du compte via my_trips", async () => {
    const { data, error } = await lucas.client.rpc("my_trips");
    expect(error).toBeNull();
    expect((data ?? []).map((row: { trip_id: string }) => row.trip_id)).toContain(tripId);
  });
});

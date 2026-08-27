import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const upsert = vi.fn();
/** Ligne de `trip_members` renvoyée à la vérification du membership. */
const maybeSingle = vi.fn();
/** Ligne de `trips` relue après le RPC, pour le code de partage réellement retenu. */
const tripRow = vi.fn();
const from = vi.fn((table: string) => {
  const single = table === "trips" ? tripRow : maybeSingle;
  const chain: { eq: () => typeof chain; maybeSingle: () => unknown } = {
    eq: () => chain,
    maybeSingle: () => single(),
  };
  return {
    select: () => chain,
    upsert: (payload: unknown, options: unknown) => upsert(table, payload, options),
  };
});
const client = { rpc, from };
let configured = true;

vi.mock("./supabase", () => ({
  getSupabase: () => (configured ? client : null),
  isSupabaseConfigured: () => configured,
}));

const currentUserId = vi.fn<() => Promise<string | null>>();
vi.mock("./auth", async () => {
  const actual = await vi.importActual<typeof import("./auth")>("./auth");
  return { ...actual, currentUserId: () => currentUserId() };
});

const { db } = await import("./database");
const { syncEngine } = await import("./sync-engine");
const { addDrinkRound, createTrip, setAuthUserId } = await import("./repository");

const USER = "11111111-1111-4111-8111-111111111111";

async function tripWithQueuedRound(): Promise<string> {
  await setAuthUserId(USER);
  const tripId = await createTrip({ name: "Marrakech 2026", creatorName: "Romain", startDate: "2026-09-07", endDate: "2026-09-16" });
  const whisky = await db.drinks.where("tripId").equals(tripId).filter((drink) => drink.name === "Whisky").first();
  await addDrinkRound(tripId, ["lucas"], whisky!.id);
  return tripId;
}

const pushedTables = () => upsert.mock.calls.map((call) => call[0] as string);

beforeEach(async () => {
  vi.clearAllMocks();
  configured = true;
  vi.stubGlobal("navigator", { onLine: true });
  currentUserId.mockResolvedValue(USER);
  maybeSingle.mockResolvedValue({ data: { trip_id: "x" }, error: null });
  tripRow.mockResolvedValue({ data: null, error: null });
  upsert.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ data: null, error: null });
  syncEngine.setUser(null);
  syncEngine.setUser(USER);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all([db.trips, db.participants, db.drinks, db.drinkEntries, db.waterEntries, db.syncQueue, db.settings].map((table) => table.clear()));
});

describe("aucune écriture sans session", () => {
  it("ne pousse rien et signale l’absence de compte", async () => {
    await tripWithQueuedRound();
    currentUserId.mockResolvedValue(null);
    syncEngine.setUser(null);

    await syncEngine.flush();

    expect(upsert).not.toHaveBeenCalled();
    expect((await db.settings.get("syncErrorKind"))?.value).toBe("auth");
    // La file reste intacte : rien n’est perdu, tout repartira à la connexion.
    expect(await db.syncQueue.count()).toBeGreaterThan(0);
  });
});

describe("membership confirmé avant toute écriture", () => {
  it("crée le séjour et son membership avant de pousser boissons et verres", async () => {
    await tripWithQueuedRound();
    // Le séjour n’existe pas encore côté serveur.
    maybeSingle.mockResolvedValue({ data: null, error: null });

    await syncEngine.flush();

    expect(rpc).toHaveBeenCalledWith("create_trip_with_owner", expect.objectContaining({ p_participant_name: "Romain" }));
    const tables = pushedTables();
    expect(tables).toContain("drinks");
    expect(tables).toContain("drink_entries");
    // L’ordre compte : le RPC passe avant la première insertion.
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(upsert.mock.invocationCallOrder[0]);
  });

  it("ne pousse aucune donnée quand le membership est refusé", async () => {
    await tripWithQueuedRound();
    maybeSingle.mockResolvedValue({ data: null, error: null });
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "trip identifier already used" } });

    await syncEngine.flush();

    // C’est exactement le scénario qui produisait des 403 en rafale sur /drinks.
    expect(upsert).not.toHaveBeenCalled();
    expect((await db.settings.get("syncErrorKind"))?.value).toBe("membership");
  });

  it("envoie created_by avec le séjour, sinon la policy d’insertion refuse l’upsert", async () => {
    await tripWithQueuedRound();

    await syncEngine.flush();

    const tripPayload = upsert.mock.calls.find((call) => call[0] === "trips")?.[1] as Record<string, unknown>;
    // PostgreSQL évalue le WITH CHECK de l’INSERT sur la ligne proposée avant de
    // détecter le conflit : sans created_by, l’upsert repart en 42501.
    expect(tripPayload.created_by).toBe(USER);
  });

  it("adopte le code de partage retenu par le serveur en cas de collision", async () => {
    const tripId = await tripWithQueuedRound();
    maybeSingle.mockResolvedValue({ data: null, error: null });
    tripRow.mockResolvedValue({ data: { share_code: "MAROC-26-ZZZZ" }, error: null });

    await syncEngine.flush();

    expect((await db.trips.get(tripId))?.shareCode).toBe("MAROC-26-ZZZZ");
    const tripPayload = upsert.mock.calls.find((call) => call[0] === "trips")?.[1] as Record<string, unknown>;
    // Le téléphone ne doit pas repousser le code en collision.
    expect(tripPayload.share_code).toBe("MAROC-26-ZZZZ");
  });

  it("ne revérifie pas le membership à chaque passage", async () => {
    await tripWithQueuedRound();
    await syncEngine.flush();
    await syncEngine.flush();

    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });
});

describe("reprise après erreur", () => {
  it("espace fortement la reprise après un refus RLS", async () => {
    await tripWithQueuedRound();
    upsert.mockResolvedValue({ error: { code: "42501", message: 'new row violates row-level security policy for table "drinks"' } });

    await syncEngine.flush();

    const operations = await db.syncQueue.toArray();
    const soonest = Math.min(...operations.map((operation) => Date.parse(operation.nextAttemptAt ?? "")));
    // Au moins quelques minutes : plus de martèlement de la même requête interdite.
    expect(soonest - Date.now()).toBeGreaterThan(60_000);
    expect((await db.settings.get("syncErrorKind"))?.value).toBe("auth");
  });

  it("garde un backoff court sur une panne réseau", async () => {
    await tripWithQueuedRound();
    upsert.mockResolvedValue({ error: new Error("Failed to fetch") });

    await syncEngine.flush();

    const operations = await db.syncQueue.toArray();
    const soonest = Math.min(...operations.map((operation) => Date.parse(operation.nextAttemptAt ?? "")));
    expect(soonest - Date.now()).toBeLessThanOrEqual(60_000);
    expect((await db.settings.get("syncErrorKind"))?.value).toBe("network");
  });

  it("efface l’erreur dès qu’une passe complète réussit", async () => {
    await tripWithQueuedRound();
    upsert.mockResolvedValueOnce({ error: new Error("Failed to fetch") });
    await syncEngine.flush();
    expect(await db.settings.get("syncError")).toBeDefined();

    upsert.mockResolvedValue({ error: null });
    await syncEngine.flush({ immediate: true });

    expect(await db.settings.get("syncError")).toBeUndefined();
    expect(await db.syncQueue.count()).toBe(0);
  });
});

describe("hors ligne", () => {
  it("laisse la file intacte sans tenter la moindre requête", async () => {
    await tripWithQueuedRound();
    const queued = await db.syncQueue.count();
    vi.stubGlobal("navigator", { onLine: false });

    await syncEngine.flush();

    expect(upsert).not.toHaveBeenCalled();
    expect(await db.syncQueue.count()).toBe(queued);
  });
});

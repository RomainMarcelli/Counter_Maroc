import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * Parcours réel à deux comptes, sur deux navigateurs séparés : Romain crée le
 * séjour, Lucas le rejoint avec le code, et chacun saisit des verres pour l’autre.
 *
 * Prérequis : migration 202608260004 appliquée, puis
 *   SUPABASE_E2E=1 npx playwright test --project=Comptes
 */
const ENABLED = process.env.SUPABASE_E2E === "1";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const stamp = Date.now();
const PASSWORD = "crew-e2e-2026";
const romainEmail = `e2e-romain-${stamp}@marrakech-crew.test`;
const lucasEmail = `e2e-lucas-${stamp}@marrakech-crew.test`;
const crewRomainEmail = `e2e-crew-romain-${stamp}@marrakech-crew.test`;
const crewLucasEmail = `e2e-crew-lucas-${stamp}@marrakech-crew.test`;
const theoEmail = `e2e-theo-${stamp}@marrakech-crew.test`;
const maxEmail = `e2e-max-${stamp}@marrakech-crew.test`;
const tripName = `E2E ${stamp}`;
const crewTripName = `E2E Crew ${stamp}`;
const testEmails = new Set([romainEmail, lucasEmail, crewRomainEmail, crewLucasEmail, theoEmail, maxEmail]);

test.skip(!ENABLED, "Nécessite un projet Supabase migré (SUPABASE_E2E=1)");
test.describe.configure({ mode: "serial" });

async function signUp(page: Page, displayName: string, email: string) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Créer un compte" }).click();
  await page.getByLabel("Prénom").fill(displayName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte", exact: true }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`Bienvenue\\s+${displayName}`) })).toBeVisible({ timeout: 40_000 });
}

async function submitJoinAndExpectIdentity(page: Page) {
  const responsePromise = page.waitForResponse(
    (response) => response.request().method() === "POST" && response.url().includes("/rest/v1/rpc/join_trip_by_code"),
    { timeout: 60_000 },
  );
  await page.getByRole("button", { name: "Rejoindre le Crew" }).click();

  let response;
  try {
    response = await responsePromise;
  } catch (cause) {
    throw new Error("Le RPC join_trip_by_code n’a renvoyé aucune réponse en 60 secondes.", { cause });
  }
  const responseBody = await response.text().catch(() => "<corps illisible>");
  expect(response.ok(), `join_trip_by_code → HTTP ${response.status()} · ${responseBody}`).toBe(true);

  const identity = page.getByRole("heading", { name: "Quel participant êtes-vous ?" });
  const joinError = page.getByRole("status").filter({ hasText: "Séjour introuvable" });
  const waitForever = () => new Promise<never>(() => undefined);
  const outcome = await Promise.race([
    identity.waitFor({ state: "visible", timeout: 40_000 }).then(() => ({ kind: "identity" as const })).catch(waitForever),
    joinError.waitFor({ state: "visible", timeout: 40_000 })
      .then(async () => ({ kind: "error" as const, message: await joinError.innerText() }))
      .catch(waitForever),
    page.waitForTimeout(41_000).then(() => ({ kind: "timeout" as const })),
  ]);

  const detail = outcome.kind === "error"
    ? `Message affiché : ${outcome.message}`
    : outcome.kind === "timeout"
      ? `RPC réussi mais écran inchangé après 41 s · URL ${page.url()}`
      : "Écran de choix du participant affiché";
  expect(outcome.kind, `join_trip_by_code → HTTP ${response.status()} · ${detail}`).toBe("identity");
}

async function joinTrip(page: Page, displayName: string, email: string, shareCode: string) {
  await signUp(page, displayName, email);
  await page.getByRole("button", { name: "Rejoindre un séjour" }).click();
  await page.getByLabel("Code de partage").fill(shareCode);
  await submitJoinAndExpectIdentity(page);
  await page.getByLabel("Ou crée ton participant").fill(displayName);
  await page.getByRole("button", { name: "Créer mon participant" }).click();
  await expect(page.getByRole("heading", { name: "Pour qui ?" })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("button", { name: /Synchronisation : Tout est synchronisé/i })).toBeVisible({ timeout: 40_000 });
}

test.afterAll(async () => {
  if (!ENABLED || !URL || !SERVICE) return;
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
  const { data: trips } = await admin.from("trips").select("id").in("name", [tripName, crewTripName]);
  for (const trip of trips ?? []) {
    const { data: photos } = await admin.from("trip_photos").select("storage_path").eq("trip_id", trip.id);
    const paths = (photos ?? []).map((photo) => photo.storage_path);
    if (paths.length) await admin.storage.from("trip-photos").remove(paths);
  }
  await admin.from("trips").delete().in("name", [tripName, crewTripName]);
  const { data } = await admin.auth.admin.listUsers();
  for (const user of data?.users ?? []) {
    if (user.email && testEmails.has(user.email)) await admin.auth.admin.deleteUser(user.id);
  }
});

test("deux comptes partagent le même séjour et saisissent l’un pour l’autre", async ({ browser }) => {
  test.setTimeout(120_000);
  const romainContext = await browser.newContext();
  const lucasContext = await browser.newContext();
  const romain = await romainContext.newPage();
  const lucas = await lucasContext.newPage();

  // --- Romain crée son compte puis le séjour --------------------------------
  await signUp(romain, "Romain", romainEmail);
  await romain.getByRole("button", { name: "Créer un séjour" }).click();
  await romain.getByLabel("Nom du séjour").fill(tripName);
  await romain.getByRole("button", { name: "Créer et commencer" }).click();
  await expect(romain.getByRole("heading", { name: "Pour qui ?" })).toBeVisible({ timeout: 40_000 });

  // Le séjour, son membership owner et le participant sont partis ensemble.
  await expect(romain.getByRole("button", { name: /Synchronisation : Tout est synchronisé/i })).toBeVisible({ timeout: 30_000 });

  await romain.getByRole("button", { name: "Ouvrir les réglages" }).click();
  const settings = romain.getByRole("dialog", { name: "Le séjour" });
  const shareCode = (await settings.locator("strong").first().innerText()).trim();
  await settings.getByRole("button", { name: "Fermer", exact: true }).click();
  expect(shareCode).not.toHaveLength(0);

  // --- Lucas crée son compte et rejoint -------------------------------------
  await signUp(lucas, "Lucas", lucasEmail);
  await lucas.getByRole("button", { name: "Rejoindre un séjour" }).click();
  await lucas.getByLabel("Code de partage").fill(shareCode);
  await submitJoinAndExpectIdentity(lucas);

  // Un compte et un participant sont deux choses distinctes : Lucas choisit la sienne.
  await lucas.getByLabel("Ou crée ton participant").fill("Lucas");
  await lucas.getByRole("button", { name: "Créer mon participant" }).click();
  await expect(lucas.getByRole("heading", { name: "Pour qui ?" })).toBeVisible({ timeout: 40_000 });

  // --- Romain sert un Mojito à Lucas ---------------------------------------
  await romain.reload();
  await expect(romain.getByRole("button", { name: /Lucas/ })).toBeVisible({ timeout: 30_000 });
  await romain.getByRole("button", { name: /Lucas/ }).click();
  await romain.getByRole("button", { name: /^Romain/ }).click(); // ne garder que Lucas
  await romain.getByRole("button", { name: "Ajouter un Mojito aux participants sélectionnés" }).click();
  await expect(romain.getByText("Mojito ajouté à Lucas")).toBeVisible();

  // Le téléphone de Lucas reçoit la mise à jour sans rien faire.
  await lucas.getByRole("link", { name: "Journal" }).click();
  await expect(lucas.getByText("Lucas · Mojito").first()).toBeVisible({ timeout: 30_000 });
  await expect(lucas.getByText(/ajouté par Romain/).first()).toBeVisible();

  // --- Lucas sert un Whisky à Romain ---------------------------------------
  await lucas.getByRole("link", { name: "Rapide" }).click();
  await lucas.getByRole("button", { name: /^Romain/ }).click();
  await lucas.getByRole("button", { name: /Lucas/ }).click(); // ne garder que Romain
  await lucas.getByRole("button", { name: "Ajouter un Whisky aux participants sélectionnés" }).click();
  await expect(lucas.getByText("Whisky ajouté à Romain")).toBeVisible();

  await romain.getByRole("link", { name: "Journal" }).click();
  await expect(romain.getByText("Romain · Whisky").first()).toBeVisible({ timeout: 30_000 });
  await expect(romain.getByText(/ajouté par Lucas/).first()).toBeVisible();

  // Aucune requête refusée dans tout le parcours.
  await expect(romain.getByRole("button", { name: /Synchronisation : Tout est synchronisé/i })).toBeVisible({ timeout: 30_000 });
  await expect(lucas.getByRole("button", { name: /Synchronisation : Tout est synchronisé/i })).toBeVisible({ timeout: 30_000 });

  await romainContext.close();
  await lucasContext.close();
});

test("la session survit à un rechargement complet", async ({ page }) => {
  const email = `e2e-session-${stamp}@marrakech-crew.test`;
  await signUp(page, "Session", email);
  await page.reload();

  // Aucun retour à l’écran de connexion : la session est relue depuis le stockage.
  await expect(page.getByRole("heading", { name: /Bienvenue\s+Session/ })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("button", { name: "Se connecter" })).toHaveCount(0);

  if (URL && SERVICE) {
    const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
    const { data } = await admin.auth.admin.listUsers();
    for (const user of data?.users ?? []) if (user.email === email) await admin.auth.admin.deleteUser(user.id);
  }
});

test("quatre comptes convergent sur une tournée, une correction, une eau, un challenge et une photo", async ({ browser }) => {
  test.setTimeout(240_000);
  const contexts = await Promise.all([0, 1, 2, 3].map(() => browser.newContext()));
  const [romain, lucas, theo, max] = await Promise.all(contexts.map((context) => context.newPage()));
  try {
    await signUp(romain, "Romain", crewRomainEmail);
    await romain.getByRole("button", { name: "Créer un séjour" }).click();
    await romain.getByLabel("Nom du séjour").fill(crewTripName);
    await romain.getByRole("button", { name: "Créer et commencer" }).click();
    await expect(romain.getByRole("heading", { name: "Pour qui ?" })).toBeVisible({ timeout: 40_000 });
    await expect(romain.getByRole("button", { name: /Synchronisation : Tout est synchronisé/i })).toBeVisible({ timeout: 40_000 });

    await romain.getByRole("button", { name: "Ouvrir les réglages" }).click();
    const settings = romain.getByRole("dialog", { name: "Le séjour" });
    const shareCode = (await settings.locator("strong").first().innerText()).trim();
    await settings.getByRole("button", { name: "Fermer", exact: true }).click();

    await joinTrip(lucas, "Lucas", crewLucasEmail, shareCode);
    await joinTrip(theo, "Théo", theoEmail, shareCode);
    await joinTrip(max, "Max", maxEmail, shareCode);

    // Realtime doit apporter les trois nouveaux participants à Romain sans reload.
    await expect(romain.getByRole("button", { name: /Lucas/ })).toBeVisible({ timeout: 40_000 });
    await expect(romain.getByRole("button", { name: /Théo/ })).toBeVisible({ timeout: 40_000 });
    await expect(romain.getByRole("button", { name: /Max/ })).toBeVisible({ timeout: 40_000 });
    await romain.getByRole("button", { name: "Tout le monde" }).click();
    await romain.getByRole("button", { name: "Ajouter un Mojito aux participants sélectionnés" }).click();
    await expect(romain.getByText("Tournée ajoutée · 4 × Mojito")).toBeVisible();
    await expect(romain.getByRole("button", { name: /Synchronisation : Tout est synchronisé/i })).toBeVisible({ timeout: 40_000 });

    // Lucas reçoit la tournée et corrige le verre de Romain en Whisky.
    await lucas.getByRole("link", { name: "Journal" }).click();
    await expect(lucas.getByText("Romain · Mojito").first()).toBeVisible({ timeout: 40_000 });
    await lucas.getByText("Romain · Mojito").first().click();
    const editor = lucas.getByRole("dialog", { name: "Modifier la consommation" });
    await editor.getByRole("button", { name: "Boisson" }).click();
    await lucas.getByRole("option", { name: "Whisky" }).click();
    await editor.getByRole("button", { name: "Enregistrer" }).click();
    await expect(lucas.getByText("Romain · Whisky").first()).toBeVisible();

    // Théo ajoute son eau, Max crée un défi de groupe.
    await theo.getByRole("button", { name: /\+1 eau/ }).click();
    await expect(theo.getByText("Eau ajoutée à Théo")).toBeVisible();
    await max.getByRole("link", { name: "Bilan" }).click();
    await max.getByRole("link", { name: "Challenges" }).click();
    await max.getByRole("button", { name: "Créer", exact: true }).click();
    const challengeDialog = max.getByRole("dialog", { name: "Créer un challenge" });
    await challengeDialog.getByLabel("Nom").fill("Photo du crew E2E");
    await challengeDialog.getByLabel("Description / objectif").fill("Réunir les quatre voyageurs");
    await challengeDialog.getByRole("button", { name: "Groupe" }).click();
    await challengeDialog.getByRole("button", { name: "Tout le séjour" }).click();
    await challengeDialog.getByRole("button", { name: "Créer", exact: true }).click();
    await expect(max.getByText("Photo du crew E2E")).toBeVisible();

    // Théo ajoute aussi un souvenir privé depuis l’interface.
    await theo.getByRole("link", { name: "Bilan" }).click();
    await theo.getByRole("link", { name: "Récaps" }).click();
    await theo.getByRole("button", { name: "Photo" }).click();
    await theo.locator("#memory-photo").setInputFiles({
      name: "crew.png", mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
    });
    await expect(theo.getByText("Photo ajoutée").first()).toBeVisible({ timeout: 40_000 });

    // Chaque téléphone observe les écritures des autres en naviguant, sans reload manuel.
    await romain.getByRole("link", { name: "Journal" }).click();
    await expect(romain.getByText("Romain · Whisky").first()).toBeVisible({ timeout: 40_000 });
    await expect(romain.getByText("Max · Mojito").first()).toBeVisible();
    await expect(lucas.getByText("Théo · Eau").first()).toBeVisible({ timeout: 40_000 });
    await romain.getByRole("link", { name: "Bilan" }).click();
    await romain.getByRole("link", { name: "Récaps" }).click();
    await expect(romain.getByRole("img", { name: "Souvenir du voyage" }).first()).toBeVisible({ timeout: 40_000 });

    // Le contrôle final porte sur les lignes serveur, pas seulement sur le DOM.
    const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
    const { data: trip } = await admin.from("trips").select("id").eq("name", crewTripName).single();
    expect(trip).not.toBeNull();
    const [participants, entries, waters, challenges, photos] = await Promise.all([
      admin.from("participants").select("id").eq("trip_id", trip!.id).is("deleted_at", null),
      admin.from("drink_entries").select("id,round_id,drink_id").eq("trip_id", trip!.id).is("deleted_at", null),
      admin.from("water_entries").select("id").eq("trip_id", trip!.id).is("deleted_at", null),
      admin.from("challenges").select("id,title").eq("trip_id", trip!.id).is("deleted_at", null),
      admin.from("trip_photos").select("id,storage_path").eq("trip_id", trip!.id).is("deleted_at", null),
    ]);
    expect(participants.data).toHaveLength(4);
    expect(entries.data).toHaveLength(4);
    expect(new Set(entries.data?.map((entry) => entry.round_id)).size).toBe(1);
    expect(waters.data).toHaveLength(1);
    expect(challenges.data?.map((challenge) => challenge.title)).toContain("Photo du crew E2E");
    expect(photos.data).toHaveLength(1);
    expect((await admin.storage.from("trip-photos").download(photos.data![0].storage_path)).error).toBeNull();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

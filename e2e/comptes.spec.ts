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
const tripName = `E2E ${stamp}`;

test.skip(!ENABLED, "Nécessite un projet Supabase migré (SUPABASE_E2E=1)");
test.describe.configure({ mode: "serial" });

async function signUp(page: Page, displayName: string, email: string) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Créer un compte" }).click();
  await page.getByLabel("Prénom").fill(displayName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte", exact: true }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`Bienvenue\\s+${displayName}`) })).toBeVisible({ timeout: 40_000 });
}

test.afterAll(async () => {
  if (!ENABLED || !URL || !SERVICE) return;
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
  await admin.from("trips").delete().eq("name", tripName);
  const { data } = await admin.auth.admin.listUsers();
  for (const user of data?.users ?? []) {
    if (user.email === romainEmail || user.email === lucasEmail) await admin.auth.admin.deleteUser(user.id);
  }
});

test("deux comptes partagent le même séjour et saisissent l’un pour l’autre", async ({ browser }) => {
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
  await expect(romain.getByRole("button", { name: /Synchronisé/ })).toBeVisible({ timeout: 30_000 });

  await romain.getByRole("button", { name: "Ouvrir les réglages" }).click();
  const settings = romain.getByRole("dialog", { name: "Le séjour" });
  const shareCode = (await settings.locator("strong").first().innerText()).trim();
  await settings.getByRole("button", { name: "Fermer", exact: true }).click();
  expect(shareCode).not.toHaveLength(0);

  // --- Lucas crée son compte et rejoint -------------------------------------
  await signUp(lucas, "Lucas", lucasEmail);
  await lucas.getByRole("button", { name: "Rejoindre un séjour" }).click();
  await lucas.getByLabel("Code de partage").fill(shareCode);
  await lucas.getByRole("button", { name: "Rejoindre le Crew" }).click();

  // Un compte et un participant sont deux choses distinctes : Lucas choisit la sienne.
  await expect(lucas.getByRole("heading", { name: "Quel participant êtes-vous ?" })).toBeVisible({ timeout: 40_000 });
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
  await expect(romain.getByRole("button", { name: /Synchronisé/ })).toBeVisible({ timeout: 30_000 });
  await expect(lucas.getByRole("button", { name: /Synchronisé/ })).toBeVisible({ timeout: 30_000 });

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

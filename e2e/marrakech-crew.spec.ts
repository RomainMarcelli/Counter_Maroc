import { expect, test, type Page } from "@playwright/test";

async function openFreshDemo(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase("marrakech-crew"); request.onsuccess = () => resolve(); request.onerror = () => resolve(); request.onblocked = () => resolve(); });
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Pour qui ?" })).toBeVisible();
}

test.beforeEach(async ({ page }) => { await openFreshDemo(page); });

test("Romain → Mojito ajoute immédiatement une consommation", async ({ page }) => {
  await page.getByRole("button", { name: "Ajouter un Mojito aux participants sélectionnés" }).click();
  await expect(page.getByText("Mojito ajouté à Romain")).toBeVisible();
  await page.getByRole("link", { name: "Journal" }).click();
  await expect(page.getByText("Romain · Mojito").first()).toBeVisible();
});

test("une tournée ajoute une bière aux trois participants", async ({ page }) => {
  await page.getByRole("button", { name: /Lucas/ }).click();
  await page.getByRole("button", { name: /Théo/ }).click();
  await page.getByRole("button", { name: "Ajouter un Bière locale aux participants sélectionnés" }).click();
  await expect(page.getByText(/Tournée ajoutée · 3/)).toBeVisible();
  await page.getByRole("link", { name: "Journal" }).click();
  await expect(page.getByText("Romain · Bière locale").first()).toBeVisible();
  await expect(page.getByText("Lucas · Bière locale").first()).toBeVisible();
  await expect(page.getByText("Théo · Bière locale").first()).toBeVisible();
});

test("une consommation hors ligne survit au rechargement", async ({ page, context }) => {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.getByRole("button", { name: "Ajouter un Mojito aux participants sélectionnés" }).click();
  await expect(page.getByText(/Enregistré sur ce téléphone/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Pour qui ?" })).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("link", { name: "Journal" }).click();
  await expect(page.getByText("Romain · Mojito").first()).toBeVisible();
});

test("modifie puis supprime une consommation", async ({ page }) => {
  await page.getByRole("button", { name: "Ajouter un Mojito aux participants sélectionnés" }).click();
  await page.getByRole("link", { name: "Journal" }).click();
  await page.getByText("Romain · Mojito").first().click();
  await page.getByLabel("Participant").selectOption({ label: "Lucas" });
  await page.getByLabel("Boisson").selectOption({ label: "🍺 Bière locale" });
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Lucas · Bière locale").first()).toBeVisible();
  await page.getByText("Lucas · Bière locale").first().click();
  await page.getByRole("button", { name: "Supprimer" }).click();
  const confirmation = page.getByRole("dialog", { name: "Supprimer cette consommation ?" });
  await expect(confirmation.getByText(/disparaîtra du Journal/)).toBeVisible();
  await confirmation.getByRole("button", { name: "Garder l’entrée" }).click();
  await expect(confirmation).toBeHidden();
  await page.getByRole("button", { name: "Supprimer" }).click();
  await confirmation.getByRole("button", { name: "Supprimer le verre" }).click();
  await expect(page.getByText("Consommation supprimée")).toBeVisible();
});

test("ajoute un nouveau cocktail", async ({ page }) => {
  await page.getByRole("button", { name: "Ajouter une boisson" }).click();
  await page.getByLabel("Nom").fill("Gin Tonic");
  await page.getByRole("button", { name: "Ajouter la boisson" }).click();
  await expect(page.getByRole("button", { name: "Ajouter un Gin Tonic aux participants sélectionnés" })).toBeVisible();
});

test("la synchronisation Supabase rejoue la queue après reconnexion", async ({ page, context }) => {
  test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL, "Nécessite un projet Supabase de test");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Ajouter un Mojito aux participants sélectionnés" }).click();
  await context.setOffline(false);
  await expect(page.getByRole("button", { name: /Synchronisé/ })).toBeVisible({ timeout: 20_000 });
});

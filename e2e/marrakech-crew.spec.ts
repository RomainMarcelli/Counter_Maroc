import { expect, test, type Page } from "@playwright/test";

async function openFreshDemo(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase("marrakech-crew"); request.onsuccess = () => resolve(); request.onerror = () => resolve(); request.onblocked = () => resolve(); });
  });
  await page.reload();
  // Marge large : `next dev` compile la route à la demande au premier passage.
  await expect(page.getByRole("heading", { name: "Pour qui ?" })).toBeVisible({ timeout: 30_000 });
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
  // Rechargement hors ligne : tout est servi par le service worker, ce qui demande un peu de marge.
  await expect(page.getByRole("heading", { name: "Pour qui ?" })).toBeVisible({ timeout: 20_000 });
  await context.setOffline(false);
  await page.getByRole("link", { name: "Journal" }).click();
  await expect(page.getByText("Romain · Mojito").first()).toBeVisible();
});

test("toutes les pages principales démarrent hors ligne depuis l’app-shell précaché", async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  const cacheState = await page.evaluate(async () => ({
    keys: await caches.keys(),
    routes: await Promise.all(["/", "/journal", "/alcoolemie", "/stats", "/hall-of-fame", "/challenges", "/recaps"]
      .map(async (route) => Boolean(await caches.match(route)))),
  }));
  expect(cacheState.keys).toContain("marrakech-crew-v6");
  expect(cacheState.routes.every(Boolean)).toBe(true);

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Pour qui ?" })).toBeVisible({ timeout: 15_000 });
  for (const [link, heading] of [["Journal", "Journal"], ["Alcoolémie", "Alcoolémie estimée"], ["Stats", "Stats"], ["Bilan", "Hall of Fame"]] as const) {
    await page.getByRole("link", { name: link, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("main")).not.toBeEmpty();
  }
  await page.getByRole("link", { name: "Challenges", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Challenges", exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("link", { name: "Retour au Bilan" }).click();
  await page.getByRole("link", { name: "Récaps", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Récaps", exact: true })).toBeVisible({ timeout: 15_000 });
});

test("modifie puis supprime une consommation", async ({ page }) => {
  await page.getByRole("button", { name: "Ajouter un Mojito aux participants sélectionnés" }).click();
  await page.getByRole("link", { name: "Journal" }).click();
  await page.getByText("Romain · Mojito").first().click();
  const editor = page.getByRole("dialog", { name: "Modifier la consommation" });
  await editor.getByRole("button", { name: "Participant" }).click();
  await page.getByRole("option", { name: "Lucas" }).click();
  await editor.getByRole("button", { name: "Boisson" }).click();
  await page.getByRole("option", { name: "Bière locale" }).click();
  await editor.getByRole("button", { name: "Enregistrer" }).click();
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

test("le filtre de catégorie tient en un tap et survit à un aller-retour vers le Journal", async ({ page }) => {
  await page.getByRole("button", { name: "Cocktails" }).click();
  await expect(page.getByRole("button", { name: "Ajouter un Mojito aux participants sélectionnés" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ajouter un Bière locale aux participants sélectionnés" })).toBeHidden();

  await page.getByRole("link", { name: "Journal" }).click();
  await page.getByRole("link", { name: "Rapide" }).click();

  await expect(page.getByRole("button", { name: "Cocktails" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Ajouter un Bière locale aux participants sélectionnés" })).toBeHidden();
});

test("Annuler retire immédiatement le verre du Journal", async ({ page }) => {
  await page.getByRole("link", { name: "Journal" }).click();
  const before = await page.getByText("Romain · Mojito").count();

  await page.getByRole("link", { name: "Rapide" }).click();
  await page.getByRole("button", { name: "Ajouter un Mojito aux participants sélectionnés" }).click();
  await expect(page.getByText("Mojito ajouté à Romain")).toBeVisible();
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByText("Mojito ajouté à Romain")).toBeHidden();

  await page.getByRole("link", { name: "Journal" }).click();
  await expect(page.getByText("Romain · Mojito")).toHaveCount(before);
});

test("sélectionne, supprime puis restaure plusieurs verres d’un coup", async ({ page }) => {
  const rows = page.locator("main button:has(strong)");
  await page.getByRole("link", { name: "Journal" }).click();
  // On attend le Journal : l’écran Rapide contient lui aussi un bouton avec un <strong>.
  await expect(page.getByRole("heading", { name: "Journal" })).toBeVisible();
  await expect(rows.first()).toBeVisible();
  const before = await rows.count();

  await page.getByRole("button", { name: "Sélectionner" }).click();
  await rows.nth(0).click();
  await rows.nth(1).click();
  await expect(page.getByText("2 sélectionnés")).toBeVisible();

  await page.getByRole("button", { name: "Supprimer" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer les 2" }).click();
  await expect(rows).toHaveCount(before - 2);
  await expect(page.getByText("2 consommations supprimées")).toBeVisible();

  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(rows).toHaveCount(before);
});

test("glisser une ligne du Journal la supprime, et Annuler la ramène", async ({ page }) => {
  await page.getByRole("button", { name: "Ajouter un Mojito aux participants sélectionnés" }).click();
  await page.getByRole("link", { name: "Journal" }).click();
  await expect(page.getByRole("heading", { name: "Journal" })).toBeVisible();

  const rows = page.locator("main button:has(strong)");
  await expect(rows.first()).toBeVisible();
  const before = await rows.count();

  const card = rows.first();
  const box = await card.boundingBox();
  if (!box) throw new Error("carte introuvable");
  // Glissement franc vers la gauche : au-delà du seuil, la ligne part directement.
  await page.mouse.move(box.x + box.width - 24, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 120, box.y + box.height / 2, { steps: 8 });
  await page.mouse.move(box.x + 20, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect(rows).toHaveCount(before - 1);
  await expect(page.getByText(/supprimé/)).toBeVisible();

  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(rows).toHaveCount(before);
});

test("l’onglet Alcoolémie liste le crew et garde l’avertissement", async ({ page }) => {
  await page.getByRole("link", { name: "Alcoolémie" }).click();
  await expect(page.getByRole("heading", { name: "Alcoolémie estimée" })).toBeVisible();
  await expect(page.getByText(/Ne pas utiliser cette estimation pour décider de conduire/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Réglages d’alcoolémie de Romain/ })).toBeVisible();
});

test("le QR Code ne s’affiche que dans sa modale", async ({ page }) => {
  await page.getByRole("button", { name: "Ouvrir les réglages" }).click();
  const settings = page.getByRole("dialog", { name: "Le séjour" });
  await expect(settings.getByRole("img", { name: /QR Code/ })).toHaveCount(0);

  await settings.getByRole("button", { name: "Afficher le QR Code" }).click();
  const invite = page.getByRole("dialog", { name: "Inviter des amis" });
  await expect(invite.getByRole("img", { name: /QR Code/ })).toBeVisible();
  await expect(invite.getByText(/\/join\?code=MAROC-26-X7K4/)).toBeVisible();
});

test("la synchronisation Supabase rejoue la queue après reconnexion", async ({ page, context }) => {
  test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL, "Nécessite un projet Supabase de test");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Ajouter un Mojito aux participants sélectionnés" }).click();
  await context.setOffline(false);
  await expect(page.getByRole("button", { name: /Synchronisation : Tout est synchronisé/i })).toBeVisible({ timeout: 20_000 });
});

test("configure un poids, ajoute deux whiskys et suit l’alcoolémie estimée", async ({ page, context }) => {
  await page.getByRole("button", { name: "Ouvrir les réglages" }).click();
  await page.getByRole("button", { name: "Estimation d’alcoolémie de Romain" }).click();
  const profil = page.getByRole("dialog", { name: /Estimation d’alcoolémie · Romain/ });
  await profil.getByRole("checkbox").first().check();
  await profil.getByLabel(/Poids/).fill("70");
  await profil.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByRole("dialog", { name: "Le séjour" }).getByRole("button", { name: "Fermer", exact: true }).click();

  // Les consommations de démo sont datées plus tard dans le séjour : le taux part de zéro.
  const estimate = page.getByText(/≈ \d,\d\d/).first();
  await expect(page.getByText("g/L estimés")).toBeVisible();
  await expect(estimate).toHaveText("≈ 0,00");

  await page.getByRole("button", { name: "Ajouter un Whisky aux participants sélectionnés" }).click();
  await page.getByRole("button", { name: "Ajouter un Whisky aux participants sélectionnés" }).click();
  // Un verre à peine servi n’est pas encore dans le sang : l’écran l’annonce au lieu d’un 0 muet.
  await expect(page.getByText("absorption en cours")).toBeVisible();

  // Le détail expose le pic et la courbe, recalculés depuis les consommations.
  await page.getByRole("button", { name: /Voir le détail de l’alcoolémie estimée de Romain/ }).click();
  const detail = page.getByRole("dialog", { name: /Alcoolémie estimée · Romain/ });
  await expect(detail.getByText("Pic estimé", { exact: true })).toBeVisible();
  await expect(detail.getByRole("heading", { name: "Boissons prises" })).toBeVisible();
  await expect(detail.getByText("Total alcool pur")).toBeVisible();
  await expect(detail.getByText("Whisky", { exact: true }).first()).toBeVisible();
  await expect(detail.getByText(/≈ 12,6 g/).first()).toBeVisible();
  await expect(detail.getByRole("img", { name: /Courbe d’alcoolémie estimée de Romain/ })).toBeVisible();
  await expect(detail.getByText(/Ne pas utiliser cette estimation pour décider de conduire/)).toBeVisible();
  await detail.getByRole("button", { name: "Fermer" }).click();

  // Annulation : l’entrée disparaît et le compteur du jour est recalculé immédiatement.
  const counter = page.getByText(/Romain · \d+ verres aujourd’hui/);
  await expect(counter).toHaveText("Romain · 2 verres aujourd’hui");
  await page.getByRole("button", { name: "Ajouter un Whisky aux participants sélectionnés" }).click();
  await expect(counter).toHaveText("Romain · 3 verres aujourd’hui");
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(counter).toHaveText("Romain · 2 verres aujourd’hui");

  // Hors ligne : écriture locale immédiate, opération en attente, puis reconnexion sans doublon.
  await context.setOffline(true);
  await page.getByRole("button", { name: "Ajouter un Whisky aux participants sélectionnés" }).click();
  await expect(page.getByText(/Enregistré sur ce téléphone/)).toBeVisible();
  await expect(counter).toHaveText("Romain · 3 verres aujourd’hui");
  await context.setOffline(false);

  await page.getByRole("link", { name: "Journal" }).click();
  await expect(page.getByText("Romain · Whisky")).toHaveCount(3);
  await expect(estimate).toBeHidden();
});

test("le Hall of Fame affiche le nouveau podium et les badges vectoriels", async ({ page }) => {
  await page.getByRole("link", { name: "Bilan" }).click();

  await expect(page.getByRole("heading", { name: "Hall of Fame" })).toBeVisible();
  await expect(page.getByLabel("Podium du séjour")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mur des trophées" })).toBeVisible();
  await expect(page.getByText("Plus gros buveur")).toBeVisible();
  await expect(page.locator('section[aria-labelledby="trophies-title"] svg').first()).toBeVisible();
});

// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildInviteUrl,
  clearPendingInvite,
  INVITE_STORAGE_KEY,
  normalizeInviteCode,
  parseInviteCode,
  peekPendingInvite,
  storePendingInvite,
  takePendingInvite,
} from "./invite";

beforeEach(() => window.localStorage.clear());

describe("lecture du lien d’invitation", () => {
  it("lit le code du lien partagé", () => {
    expect(parseInviteCode("https://crew.app/join?code=MAROC-26-X7K4")).toBe("MAROC-26-X7K4");
  });

  it("accepte encore l’ancien format des QR Codes déjà distribués", () => {
    expect(parseInviteCode("https://crew.app/?join=MAROC-26-X7K4")).toBe("MAROC-26-X7K4");
  });

  it("normalise la casse et les espaces d’un code collé à la main", () => {
    expect(normalizeInviteCode("  maroc-26-x7k4 ")).toBe("MAROC-26-X7K4");
  });

  it("refuse ce qui ne ressemble pas à un code", () => {
    expect(parseInviteCode("https://crew.app/join")).toBeNull();
    expect(parseInviteCode("https://crew.app/join?code=ab")).toBeNull();
    expect(normalizeInviteCode("code invalide !")).toBeNull();
  });

  it("construit un lien partageable sans doubler la barre oblique", () => {
    expect(buildInviteUrl("https://crew.app/", "MAROC-26-X7K4")).toBe("https://crew.app/join?code=MAROC-26-X7K4");
  });
});

describe("conservation du code pendant l’authentification", () => {
  it("garde le code le temps de créer un compte, puis le rend une seule fois", () => {
    storePendingInvite("maroc-26-x7k4");

    // L’écran de connexion s’intercale : le code doit survivre à cette étape.
    expect(window.localStorage.getItem(INVITE_STORAGE_KEY)).toBe("MAROC-26-X7K4");
    expect(peekPendingInvite()).toBe("MAROC-26-X7K4");

    expect(takePendingInvite()).toBe("MAROC-26-X7K4");
    // Une invitation ne se rejoue pas : le séjour suivant ne doit pas être proposé en boucle.
    expect(takePendingInvite()).toBeNull();
  });

  it("n’enregistre jamais une valeur douteuse", () => {
    storePendingInvite("??");
    expect(peekPendingInvite()).toBeNull();
  });

  it("s’oublie sur demande", () => {
    storePendingInvite("MAROC-26-X7K4");
    clearPendingInvite();
    expect(peekPendingInvite()).toBeNull();
  });
});

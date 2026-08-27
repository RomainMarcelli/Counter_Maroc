// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SwipeRow } from "./swipe-row";

// jsdom n’implémente pas la capture de pointeur : le composant s’en sert pour
// garder le geste quand le doigt sort de la carte.
beforeAll(() => {
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => undefined;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => undefined;
});

const onDelete = vi.fn();
const onOpenChange = vi.fn();

function setup(open = false) {
  const { container } = render(
    <SwipeRow open={open} onOpenChange={onOpenChange} onDelete={onDelete} deleteLabel="Supprimer Mojito de Romain">
      <button>Romain · Mojito</button>
    </SwipeRow>,
  );
  // La surface qui porte le geste est le second enfant : le premier est le tiroir.
  return container.firstElementChild!.lastElementChild as HTMLElement;
}

/** La largeur mesurée vaut 0 dans jsdom : le composant retombe sur 320 px. */
const WIDTH = 320;

function swipe(surface: HTMLElement, dx: number, dy = 0) {
  fireEvent.pointerDown(surface, { pointerId: 1, clientX: 200, clientY: 100 });
  fireEvent.pointerMove(surface, { pointerId: 1, clientX: 200 + dx / 2, clientY: 100 + dy / 2 });
  fireEvent.pointerMove(surface, { pointerId: 1, clientX: 200 + dx, clientY: 100 + dy });
  fireEvent.pointerUp(surface, { pointerId: 1, clientX: 200 + dx, clientY: 100 + dy });
}

beforeEach(() => {
  onDelete.mockClear();
  onOpenChange.mockClear();
});

afterEach(cleanup);

describe("glissement d’une ligne du Journal", () => {
  it("ignore un frôlement : la carte revient en place", () => {
    swipe(setup(), -18);

    expect(onDelete).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("révèle Supprimer sur un glissement franc mais court", () => {
    swipe(setup(), -70);

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("supprime directement au-delà de la moitié de la carte", () => {
    swipe(setup(), -(WIDTH * 0.5));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("laisse le scroll vertical passer : un geste vers le bas ne déclenche rien", () => {
    // Le doigt descend nettement plus qu’il ne dérive : c’est un scroll, pas un swipe.
    swipe(setup(), -40, 120);

    expect(onDelete).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("reste utilisable sans geste : le bouton révélé se touche normalement", () => {
    setup(true);

    screen.getByRole("button", { name: "Supprimer Mojito de Romain" }).click();

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("garde le bouton hors du parcours clavier tant que la ligne est fermée", () => {
    const surface = setup(false);
    // Le tiroir est masqué derrière la carte : il ne doit pas capter le focus au clavier.
    const drawer = surface.parentElement!.querySelector("button[aria-label]") as HTMLButtonElement;
    expect(drawer.tabIndex).toBe(-1);
  });
});

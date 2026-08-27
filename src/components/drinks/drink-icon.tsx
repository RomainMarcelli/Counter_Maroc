import { Beer, CupSoda, GlassWater, Martini, Wine } from "lucide-react";
import { DRINK_TINTS, resolveDrinkIconKey, resolveDrinkTint, type DrinkIconKey, type DrinkTint } from "@/domain/drink-icons";
import type { DrinkCategory } from "@/domain/types";

interface GlyphProps {
  size: number;
  strokeWidth: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Trois verres que lucide ne fournit pas, dessinés sur la même grille 24×24 et
 * avec les mêmes traits arrondis, pour rester homogènes avec les autres.
 * Tout est inline : aucune requête réseau, donc les icônes restent disponibles
 * hors ligne dans la PWA.
 */
function Svg({ size, strokeWidth, className, style, children }: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Bouteille trapue, épaule marquée : le rhum. */
function RumGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M10 2h4v3.2c0 .9.3 1.7.9 2.3l1 1.1c.7.8 1.1 1.8 1.1 2.9V20a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8.5c0-1.1.4-2.1 1.1-2.9l1-1.1c.6-.6.9-1.4.9-2.3V2Z" />
      <path d="M7 13h10" />
    </Svg>
  );
}

/** Petit verre droit : la vodka. */
function VodkaGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M8 4h8l-1 14a2 2 0 0 1-2 1.8h-2A2 2 0 0 1 9 18L8 4Z" />
      <path d="M8.4 10h7.2" />
      <path d="M9 22h6" />
    </Svg>
  );
}

/** Verre ballon sur pied : le gin. */
function GinGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M6 6.5A6 6 0 0 0 12 14a6 6 0 0 0 6-7.5" />
      <path d="M6 6.5h12" />
      <path d="M12 14v5" />
      <path d="M8.5 21h7" />
    </Svg>
  );
}

type Glyph = (props: GlyphProps) => React.ReactElement;

const GLYPHS: Record<DrinkIconKey, Glyph> = {
  beer: (props) => <Beer size={props.size} strokeWidth={props.strokeWidth} className={props.className} style={props.style} aria-hidden="true" />,
  wine: (props) => <Wine size={props.size} strokeWidth={props.strokeWidth} className={props.className} style={props.style} aria-hidden="true" />,
  cocktail: (props) => <Martini size={props.size} strokeWidth={props.strokeWidth} className={props.className} style={props.style} aria-hidden="true" />,
  whisky: (props) => <GlassWater size={props.size} strokeWidth={props.strokeWidth} className={props.className} style={props.style} aria-hidden="true" />,
  rum: RumGlyph,
  vodka: VodkaGlyph,
  gin: GinGlyph,
  generic: (props) => <CupSoda size={props.size} strokeWidth={props.strokeWidth} className={props.className} style={props.style} aria-hidden="true" />,
};

/**
 * La teinte passe par `--drink-tint` avec la couleur du verre en repli. Un
 * conteneur sombre — option sélectionnée d’une feuille, snackbar vert — pose la
 * variable une fois (`.tint-neutral`) et neutralise toute sa sous-arborescence,
 * là où une couleur écrite en dur resterait illisible.
 */
function tintStyle(tint: DrinkTint | null | undefined): React.CSSProperties | undefined {
  return tint ? { color: `var(--drink-tint, ${DRINK_TINTS[tint]})` } : undefined;
}

export function DrinkIconGlyph({ iconKey, tint, size = 22, strokeWidth = 1.9, className }: {
  iconKey: DrinkIconKey;
  /** Absente, l’icône suit la couleur du texte : c’est ce qu’il faut sur fond vert. */
  tint?: DrinkTint | null;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const Glyph = GLYPHS[iconKey] ?? GLYPHS.generic;
  return <Glyph size={size} strokeWidth={strokeWidth} className={className} style={tintStyle(tint)} />;
}

/** Pictogramme d’une boisson, quel que soit ce que porte sa colonne `icon`. */
export function DrinkIcon({ drink, tinted = true, size = 22, strokeWidth = 1.9, className }: {
  drink: { icon: string; name: string; category: DrinkCategory };
  /** `false` pour rendre la main à la couleur du texte, sur un fond sombre. */
  tinted?: boolean;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <DrinkIconGlyph
      iconKey={resolveDrinkIconKey(drink)}
      tint={tinted ? resolveDrinkTint(drink) : null}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
    />
  );
}

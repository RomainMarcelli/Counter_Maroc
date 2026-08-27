"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, LoaderCircle, Share2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useToast } from "@/components/providers/toast-provider";
import { buildInviteUrl } from "@/lib/invite";
import type { Trip } from "@/domain/types";

/** Copie fiable sur iOS : `navigator.clipboard` échoue hors contexte sécurisé. */
async function copy(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function InviteSheet({ trip, open, onClose }: { trip: Trip; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [canShare, setCanShare] = useState(false);
  const inviteUrl = typeof window === "undefined" ? "" : buildInviteUrl(window.location.origin, trip.shareCode);

  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);

  // Le QR n’est calculé qu’à l’ouverture : il ne coûte rien tant qu’il reste rangé.
  useEffect(() => {
    if (!open || !inviteUrl) return;
    void QRCode.toDataURL(inviteUrl, { width: 640, margin: 1, color: { dark: "#1E4A3A", light: "#FFF8EC" } }).then(setQr);
  }, [open, inviteUrl]);

  const handleCopy = async (kind: "code" | "link") => {
    const done = await copy(kind === "code" ? trip.shareCode : inviteUrl);
    if (!done) {
      toast({ message: "Copie impossible", detail: "Sélectionne le texte et copie-le à la main.", tone: "error" });
      return;
    }
    setCopied(kind);
    setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1800);
    toast({ message: kind === "code" ? "Code copié" : "Lien copié" });
  };

  const share = async () => {
    try {
      await navigator.share({
        title: "Marrakech Crew",
        text: `Rejoins ${trip.name} sur Marrakech Crew`,
        url: inviteUrl,
      });
    } catch {
      // Partage refusé ou annulé : rien à signaler, l’utilisateur a fermé la feuille iOS.
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Inviter des amis">
      <div className="space-y-5">
        <div className="mx-auto w-fit rounded-3xl bg-ivory p-3 shadow-card ring-1 ring-sand">
          {qr ? (
            <Image src={qr} alt={`QR Code pour rejoindre ${trip.name}`} width={248} height={248} unoptimized className="size-[248px]" />
          ) : (
            <span className="flex size-[248px] items-center justify-center text-morocco/40"><LoaderCircle size={28} className="animate-spin" /></span>
          )}
        </div>
        <p className="text-center text-xs font-bold text-morocco/55">À scanner avec l’appareil photo de l’iPhone.</p>

        <section className="rounded-2xl border border-sand bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-morocco/50">Code du séjour</p>
          <div className="mt-1.5 flex items-center gap-3">
            <strong className="min-w-0 flex-1 truncate font-display text-2xl tracking-wider">{trip.shareCode}</strong>
            <button onClick={() => void handleCopy("code")} className="tap-bump flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-sand px-3 text-xs font-black" aria-label="Copier le code du séjour">
              {copied === "code" ? <Check size={15} className="text-morocco" /> : <Copy size={15} />}Copier
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-sand bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-morocco/50">Lien d’invitation</p>
          <p className="mt-1.5 break-all text-xs font-bold text-morocco/70">{inviteUrl}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => void handleCopy("link")} className="tap-bump flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-sand text-sm font-black" aria-label="Copier le lien d’invitation">
              {copied === "link" ? <Check size={16} className="text-morocco" /> : <Copy size={16} />}Copier
            </button>
            <button onClick={() => void share()} disabled={!canShare} className="tap-bump flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-terra text-sm font-black text-ivory disabled:opacity-40" aria-label="Partager l’invitation">
              <Share2 size={16} />Partager
            </button>
          </div>
          {canShare ? null : <p className="mt-2 text-[11px] font-bold text-morocco/45">Le partage natif n’est pas disponible sur ce navigateur.</p>}
        </section>
      </div>
    </BottomSheet>
  );
}

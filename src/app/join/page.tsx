"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandLoader } from "@/components/brand/brand-loader";

/**
 * Point d’entrée d’un lien d’invitation. Le code a déjà été mis de côté par
 * `InviteCapture`, monté au-dessus des portes d’authentification : il ne reste
 * qu’à ramener l’application sur son écran d’accueil, qui proposera de rejoindre.
 */
export default function JoinPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/"); }, [router]);
  return <BrandLoader />;
}

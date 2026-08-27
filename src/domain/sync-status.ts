export type SyncStatusKind = "synced" | "offline" | "pending" | "syncing" | "error" | "auth" | "local" | "connecting";

export interface SyncStatusInput {
  backendConfigured: boolean;
  /** Mode local volontaire, réservé au seed de démonstration. */
  localMode: boolean;
  authStatus: "loading" | "authenticated" | "unauthenticated";
  online: boolean;
  pending: number;
  syncing: boolean;
  errorKind: "auth" | "membership" | "network" | "";
}

export interface SyncStatusView {
  kind: SyncStatusKind;
  label: string;
  healthy: boolean;
}

/**
 * Machine d’état pure de l’indicateur.
 *
 * « Mode local » ne dépend jamais d’un délai, d’une erreur ponctuelle ni de
 * `navigator.onLine` : il signifie uniquement que ce build n’a pas de backend,
 * ou que le mode démonstration local a été demandé explicitement.
 */
export function resolveSyncStatus(input: SyncStatusInput): SyncStatusView {
  if (!input.backendConfigured || input.localMode) return { kind: "local", label: "Mode local", healthy: false };
  if (!input.online) {
    const suffix = input.pending ? ` · ${input.pending} action${input.pending > 1 ? "s" : ""} locale${input.pending > 1 ? "s" : ""}` : "";
    return { kind: "offline", label: `Hors ligne${suffix}`, healthy: false };
  }
  if (input.authStatus === "loading") return { kind: "connecting", label: "Connexion à Supabase", healthy: false };
  if (input.authStatus === "unauthenticated" || input.errorKind === "auth") return { kind: "auth", label: "Session expirée", healthy: false };
  if (input.errorKind === "membership" || input.errorKind === "network") return { kind: "error", label: "Erreur de synchronisation", healthy: false };
  if (input.syncing) return { kind: "syncing", label: "Synchronisation en cours", healthy: false };
  if (input.pending) return { kind: "pending", label: "Synchronisation en attente", healthy: false };
  return { kind: "synced", label: "Synchronisé", healthy: true };
}

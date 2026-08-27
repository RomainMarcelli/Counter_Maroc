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
  tone: "green" | "orange" | "red";
}

export function resolveSyncStatus(input: SyncStatusInput): SyncStatusView {
  if (!input.backendConfigured || input.localMode) return { kind: "local", label: "Backend non configuré", healthy: false, tone: "red" };
  if (!input.online) {
    const suffix = input.pending ? ` · ${input.pending} action${input.pending > 1 ? "s" : ""} locale${input.pending > 1 ? "s" : ""}` : "";
    return { kind: "offline", label: `Hors ligne${suffix}`, healthy: false, tone: "red" };
  }
  if (input.authStatus === "loading") return { kind: "connecting", label: "Connexion à Supabase", healthy: false, tone: "orange" };
  if (input.authStatus === "unauthenticated" || input.errorKind === "auth") return { kind: "auth", label: "Session expirée", healthy: false, tone: "red" };
  if (input.errorKind === "membership" || input.errorKind === "network") return { kind: "error", label: "Erreur de synchronisation", healthy: false, tone: "red" };
  if (input.syncing) return { kind: "syncing", label: "Synchronisation en cours", healthy: false, tone: "orange" };
  if (input.pending) return { kind: "pending", label: "Synchronisation en attente", healthy: false, tone: "orange" };
  return { kind: "synced", label: "Tout est synchronisé", healthy: true, tone: "green" };
}

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthAccount {
  id: string;
  email: string;
  displayName: string;
}

export interface SignUpResult {
  account: AuthAccount | null;
  /** Le projet exige une confirmation par email : le compte existe mais la session n’est pas ouverte. */
  needsEmailConfirmation: boolean;
}

/** Supabase n’est pas configuré : l’application reste utilisable, mais uniquement sur ce téléphone. */
export class SupabaseUnavailableError extends Error {
  constructor() {
    super("Configurez Supabase pour créer un compte et partager un séjour.");
    this.name = "SupabaseUnavailableError";
  }
}

function requireClient(): SupabaseClient {
  const client = getSupabase();
  if (!client) throw new SupabaseUnavailableError();
  return client;
}

/**
 * Traduit une erreur Supabase en phrase lisible. Les libellés techniques
 * (`AuthApiError: …`) restent dans la console, jamais dans l’interface.
 */
export function authErrorMessage(error: unknown): string {
  if (error instanceof SupabaseUnavailableError) return error.message;
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.toLowerCase();
  if (!raw) return "Une erreur inattendue est survenue.";
  if (message.includes("failed to fetch") || message.includes("networkerror") || message.includes("load failed")) {
    return "Impossible de joindre Supabase. Vérifie ta connexion.";
  }
  if (message.includes("invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (message.includes("already registered") || message.includes("already been registered") || message.includes("user_already_exists")) {
    return "Cet email possède déjà un compte.";
  }
  if (message.includes("email not confirmed")) return "Compte non confirmé. Vérifie ton email avant de te connecter.";
  if (message.includes("password should be at least") || message.includes("weak_password")) {
    return "Le mot de passe doit contenir au moins 6 caractères.";
  }
  if (message.includes("unable to validate email") || message.includes("invalid email")) return "Cet email n’est pas valide.";
  if (message.includes("anonymous")) return "Les connexions anonymes ne sont plus utilisées : crée un compte.";
  if (message.includes("jwt expired") || message.includes("session_not_found") || message.includes("refresh token")) {
    return "Session expirée. Reconnecte-toi.";
  }
  if (message.includes("rate limit") || message.includes("too many requests") || message.includes("over_email_send_rate")) {
    return "Trop de tentatives. Réessaie dans quelques minutes.";
  }
  if (message.includes("signups not allowed") || message.includes("signup_disabled")) {
    return "Les inscriptions sont désactivées sur ce projet Supabase.";
  }
  return raw;
}

/** Reconnaît les refus d’autorisation, qui ne se règlent jamais en réessayant tout de suite. */
export function isAuthorizationError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? "";
  const status = (error as { status?: number } | null)?.status ?? 0;
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  return (
    code === "42501"
    || code === "28000"
    || code === "PGRST301"
    || status === 401
    || status === 403
    || message.includes("row-level security")
    || message.includes("jwt expired")
    || message.includes("authentication required")
    || message.includes("not a trip member")
  );
}

function accountFromSession(session: Session | null): AuthAccount | null {
  if (!session?.user) return null;
  const metadata = session.user.user_metadata as { display_name?: unknown } | null;
  const fromMetadata = typeof metadata?.display_name === "string" ? metadata.display_name.trim() : "";
  const email = session.user.email ?? "";
  return {
    id: session.user.id,
    email,
    displayName: fromMetadata || email.split("@")[0] || "Crew",
  };
}

/**
 * Session courante. Lue depuis le stockage local du client Supabase : elle reste
 * disponible hors ligne, ce qui permet de rouvrir l’application en mode avion.
 */
export async function currentSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) return null;
  const client = getSupabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session ?? null;
}

export async function currentAccount(): Promise<AuthAccount | null> {
  return accountFromSession(await currentSession());
}

export async function currentUserId(): Promise<string | null> {
  return (await currentSession())?.user.id ?? null;
}

export async function signUpWithPassword(input: { email: string; password: string; displayName: string }): Promise<SignUpResult> {
  const client = requireClient();
  const displayName = input.displayName.trim();
  const { data, error } = await client.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  // Sans confirmation email, Supabase ouvre directement la session.
  if (!data.session) return { account: null, needsEmailConfirmation: true };
  await upsertProfile(client, data.session.user.id, displayName);
  return { account: accountFromSession(data.session), needsEmailConfirmation: false };
}

export async function signInWithPassword(input: { email: string; password: string }): Promise<AuthAccount> {
  const client = requireClient();
  const { data, error } = await client.auth.signInWithPassword({ email: input.email.trim(), password: input.password });
  if (error) throw error;
  const account = accountFromSession(data.session);
  if (!account) throw new Error("Session introuvable après la connexion.");
  return account;
}

export async function signOut(): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  // `local` : on ferme la session de ce téléphone sans déconnecter les autres appareils.
  await client.auth.signOut({ scope: "local" });
}

/**
 * Filet de sécurité : le trigger `on_auth_user_created` crée déjà le profil.
 * Cet appel rattrape les comptes créés avant la migration et ne casse jamais
 * la connexion s’il échoue (hors ligne, par exemple).
 */
async function upsertProfile(client: SupabaseClient, userId: string, displayName: string): Promise<void> {
  if (!displayName) return;
  try {
    await client.from("profiles").upsert({ id: userId, display_name: displayName, updated_at: new Date().toISOString() }, { onConflict: "id" });
  } catch {
    // Le prénom reste disponible dans user_metadata : rien de bloquant.
  }
}

export async function syncProfileName(displayName: string): Promise<void> {
  const client = getSupabase();
  const userId = await currentUserId();
  if (!client || !userId) return;
  await upsertProfile(client, userId, displayName);
}

export function onAuthChange(callback: (session: Session | null) => void): () => void {
  const client = getSupabase();
  if (!client) return () => undefined;
  const { data } = client.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export { accountFromSession };

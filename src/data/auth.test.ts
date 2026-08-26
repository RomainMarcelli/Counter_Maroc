import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = {
  getSession: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
};
const from = vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({ error: null }) }));

vi.mock("./supabase", () => ({
  getSupabase: () => ({ auth, from }),
  isSupabaseConfigured: () => true,
}));

const {
  accountFromSession,
  authErrorMessage,
  currentSession,
  currentUserId,
  isAuthorizationError,
  signInWithPassword,
  signOut,
  signUpWithPassword,
} = await import("./auth");

const session = (overrides: Record<string, unknown> = {}) => ({
  user: { id: "user-1", email: "romain@email.fr", user_metadata: { display_name: "Romain" }, ...overrides },
});

beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: null }) });
});

describe("messages d’erreur", () => {
  it("traduit les refus Supabase courants sans exposer AuthApiError", () => {
    expect(authErrorMessage(new Error("Invalid login credentials"))).toBe("Email ou mot de passe incorrect.");
    expect(authErrorMessage(new Error("User already registered"))).toBe("Cet email possède déjà un compte.");
    expect(authErrorMessage(new Error("Failed to fetch"))).toBe("Impossible de joindre Supabase. Vérifie ta connexion.");
    expect(authErrorMessage(new Error("JWT expired"))).toBe("Session expirée. Reconnecte-toi.");
    expect(authErrorMessage(new Error("Password should be at least 6 characters"))).toBe("Le mot de passe doit contenir au moins 6 caractères.");
    expect(authErrorMessage(new Error("Email not confirmed"))).toBe("Compte non confirmé. Vérifie ton email avant de te connecter.");
  });

  it("ne laisse jamais passer un message vide", () => {
    expect(authErrorMessage(null)).toBe("Une erreur inattendue est survenue.");
  });
});

describe("erreurs d’autorisation", () => {
  it("reconnaît un refus RLS, qui ne se règle pas en réessayant", () => {
    expect(isAuthorizationError({ code: "42501", message: 'new row violates row-level security policy for table "drinks"' })).toBe(true);
    expect(isAuthorizationError({ status: 403, message: "Forbidden" })).toBe(true);
    expect(isAuthorizationError(new Error("authentication required"))).toBe(true);
  });

  it("laisse les pannes réseau au backoff habituel", () => {
    expect(isAuthorizationError(new Error("Failed to fetch"))).toBe(false);
    expect(isAuthorizationError({ status: 500, message: "Internal error" })).toBe(false);
  });
});

describe("création de compte", () => {
  it("ouvre la session et retient le prénom quand la confirmation email est désactivée", async () => {
    auth.signUp.mockResolvedValue({ data: { session: session() }, error: null });

    const result = await signUpWithPassword({ email: "romain@email.fr", password: "secret1", displayName: "Romain" });

    expect(result.needsEmailConfirmation).toBe(false);
    expect(result.account).toEqual({ id: "user-1", email: "romain@email.fr", displayName: "Romain" });
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { data: { display_name: "Romain" } } }));
  });

  it("signale la confirmation email au lieu de laisser l’écran figé", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: { id: "user-1" } }, error: null });

    const result = await signUpWithPassword({ email: "romain@email.fr", password: "secret1", displayName: "Romain" });

    expect(result).toEqual({ account: null, needsEmailConfirmation: true });
  });

  it("remonte l’erreur telle quelle pour que l’appel la traduise", async () => {
    auth.signUp.mockResolvedValue({ data: {}, error: new Error("User already registered") });
    await expect(signUpWithPassword({ email: "a@b.fr", password: "secret1", displayName: "A" })).rejects.toThrow("User already registered");
  });
});

describe("connexion", () => {
  it("retourne le compte connecté", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { session: session() }, error: null });
    await expect(signInWithPassword({ email: " romain@email.fr ", password: "secret1" })).resolves.toEqual({
      id: "user-1", email: "romain@email.fr", displayName: "Romain",
    });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "romain@email.fr", password: "secret1" });
  });

  it("échoue proprement sur un mot de passe incorrect", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: new Error("Invalid login credentials") });
    await expect(signInWithPassword({ email: "romain@email.fr", password: "faux" })).rejects.toThrow();
  });
});

describe("session persistante", () => {
  it("relit la session du stockage local, sans appel réseau", async () => {
    auth.getSession.mockResolvedValue({ data: { session: session() } });

    expect(await currentUserId()).toBe("user-1");
    // getUser() interrogerait le serveur : hors ligne, l’application resterait bloquée.
    expect(auth.getSession).toHaveBeenCalledTimes(1);
  });

  it("retourne null quand plus aucune session n’est stockée", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    expect(await currentSession()).toBeNull();
    expect(await currentUserId()).toBeNull();
  });

  it("retombe sur l’email quand aucun prénom n’a été saisi", () => {
    expect(accountFromSession(session({ user_metadata: {} }) as never)?.displayName).toBe("romain");
  });
});

describe("déconnexion", () => {
  it("ne ferme que la session de ce téléphone", async () => {
    auth.signOut.mockResolvedValue({ error: null });
    await signOut();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});

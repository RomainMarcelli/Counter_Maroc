import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
}

/**
 * Client Supabase unique. `persistSession` conserve la session dans le stockage du
 * navigateur : une PWA installée reste connectée d’un lancement à l’autre, et la
 * session est relue hors ligne sans appel réseau.
 */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  client = url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "marrakech-crew-auth",
          flowType: "pkce",
        },
        realtime: { params: { eventsPerSecond: 10 } },
      })
    : null;
  return client;
}

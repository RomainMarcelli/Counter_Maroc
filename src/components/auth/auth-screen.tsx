"use client";

import { useState } from "react";
import { Eye, EyeOff, LoaderCircle, MailCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { authErrorMessage, signInWithPassword, signUpWithPassword } from "@/data/auth";

type Mode = "signin" | "signup";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [form, setForm] = useState({ displayName: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  const swap = (next: Mode) => {
    setMode(next);
    setError(null);
    setConfirmationSentTo(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const result = await signUpWithPassword(form);
        // Le projet peut exiger une confirmation : on le dit au lieu de laisser
        // l’écran figé sur un bouton qui semble ne rien faire.
        if (result.needsEmailConfirmation) setConfirmationSentTo(form.email.trim());
      } else {
        await signInWithPassword(form);
      }
      // La session ouverte est captée par l’AuthProvider : rien à faire de plus ici.
    } catch (cause) {
      if (process.env.NODE_ENV === "development") console.error(cause);
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  if (confirmationSentTo) {
    return (
      <Shell>
        <div className="rounded-3xl border border-sand bg-white/80 p-6 text-center shadow-card">
          <MailCheck size={34} className="mx-auto text-terra" />
          <h2 className="mt-4 font-display text-2xl font-bold">Compte créé.</h2>
          <p className="mt-2 text-sm leading-relaxed text-morocco/65">Vérifie ton email : un lien a été envoyé à <strong className="break-all">{confirmationSentTo}</strong>. Reviens ici une fois l’adresse confirmée.</p>
          <button onClick={() => swap("signin")} className="tap-bump mt-5 min-h-12 w-full rounded-2xl bg-morocco font-extrabold text-ivory">Aller à la connexion</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={submit} className="space-y-3 rounded-3xl border border-sand/70 bg-white/80 p-5 shadow-card">
        <div className="mb-1 flex gap-1 rounded-2xl bg-sand/30 p-1" role="tablist" aria-label="Connexion ou création de compte">
          <Tab active={mode === "signin"} onClick={() => swap("signin")}>Se connecter</Tab>
          <Tab active={mode === "signup"} onClick={() => swap("signup")}>Créer un compte</Tab>
        </div>

        {mode === "signup" ? (
          <Field label="Prénom" value={form.displayName} autoComplete="given-name" placeholder="Romain" onChange={(displayName) => setForm({ ...form, displayName })} />
        ) : null}

        <Field label="Email" type="email" inputMode="email" autoComplete="email" placeholder="romain@email.fr" value={form.email} onChange={(email) => setForm({ ...form, email })} />

        <label className="block text-xs font-extrabold uppercase tracking-wider">
          Mot de passe
          <span className="relative mt-2 block">
            <input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={6}
              required
              className="min-h-14 w-full rounded-2xl border border-sand bg-ivory pl-4 pr-14 text-base font-bold outline-none focus:border-morocco"
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-morocco/50" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>

        {error ? <p role="alert" className="rounded-2xl border border-terra/40 bg-terra/10 px-4 py-3 text-sm font-bold text-terra">{error}</p> : null}

        <button disabled={busy} className="tap-bump flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-morocco text-base font-extrabold text-ivory disabled:opacity-60">
          {busy ? <LoaderCircle size={18} className="animate-spin" /> : null}
          {mode === "signup" ? "Créer mon compte" : "Se connecter"}
        </button>

        <p className="pt-1 text-center text-sm font-bold text-morocco/60">
          {mode === "signup" ? "Déjà un compte ?" : "Pas encore de compte ?"}{" "}
          <button type="button" onClick={() => swap(mode === "signup" ? "signin" : "signup")} className="min-h-11 font-black text-terra underline underline-offset-4">
            {mode === "signup" ? "Se connecter" : "Créer mon compte"}
          </button>
        </p>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(32px+env(safe-area-inset-top))]">
      <div className="text-center">
        <BrandLogo size={72} className="mx-auto rounded-[24px] shadow-card" priority />
        <h1 className="mt-5 font-display text-4xl font-bold leading-none">Marrakech Crew</h1>
        <p className="mt-2 text-sm font-bold text-morocco/60">Le compteur de votre séjour 🇲🇦</p>
      </div>
      {children}
    </main>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`min-h-11 flex-1 rounded-xl text-sm font-black transition ${active ? "bg-morocco text-ivory shadow-sm" : "text-morocco/60"}`}>
      {children}
    </button>
  );
}

function Field({ label, value, onChange, type = "text", ...rest }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "email" | "text";
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-extrabold uppercase tracking-wider">
      {label}
      <input
        {...rest}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        className="mt-2 min-h-14 w-full rounded-2xl border border-sand bg-ivory px-4 text-base font-bold outline-none focus:border-morocco"
      />
    </label>
  );
}

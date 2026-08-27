"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Award, Check, ChevronLeft, CirclePlus, Dices, Droplets, Flag, Sparkles, Target, Trash2, Users } from "lucide-react";
import { useTrip } from "@/components/providers/trip-provider";
import { useToast } from "@/components/providers/toast-provider";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ParticipantGrid } from "@/components/participants/participant-grid";
import { CHALLENGE_PRESETS, SAFE_FORFEITS, calculateChallengeProgress, effectiveChallengeStatus, type ChallengePreset } from "@/domain/challenges";
import { addChallenge, addForfeit, completeForfeit, deleteChallenge, deleteForfeit, setChallengeStatus } from "@/data/repository";
import { getTripDayKey } from "@/lib/trip-day";
import type { Challenge, ChallengePeriod, ChallengeScope, Participant } from "@/domain/types";

type AudienceFilter = "me" | "group" | "all";

export function ChallengesPage() {
  const { trip, actorId, activeParticipants, drinks, drinkEntries, waterEntries, challenges, forfeits, tripPhotos } = useTrip();
  const toast = useToast();
  const [filter, setFilter] = useState<AudienceFilter>("all");
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [preset, setPreset] = useState<ChallengePreset | null>(null);
  const [presetFor, setPresetFor] = useState<string | null>(null);
  const today = getTripDayKey(new Date());

  const visible = useMemo(() => challenges.filter((item) => !item.deletedAt && (
    filter === "all" || (filter === "me" ? item.participantId === actorId : item.scope === "group")
  )), [challenges, filter, actorId]);

  if (!trip) return null;
  const sections: Array<{ key: ChallengePeriod; title: string }> = [{ key: "day", title: "Aujourd’hui" }, { key: "trip", title: "Séjour" }];

  const openPreset = (item: ChallengePreset) => {
    setPreset(item);
    // Un défi de groupe n’appartient à personne : il ne se ré-attribue pas.
    setPresetFor(item.defaultScope === "group" ? null : actorId);
  };

  const createPreset = async (item: ChallengePreset) => {
    const scope: ChallengeScope = item.defaultScope;
    await addChallenge(trip.id, {
      title: item.title,
      description: item.description,
      targetType: item.targetType,
      targetValue: item.targetValue,
      period: item.period,
      scope,
      participantId: scope === "group" ? null : presetFor ?? actorId,
      dayKey: item.period === "day" ? today : null,
      reward: null,
    });
    toast({ message: "Challenge créé", detail: item.title });
    setPreset(null);
  };

  return (
    <div className="space-y-7">
      <header>
        <Link href="/hall-of-fame" className="mb-3 inline-flex min-h-11 items-center gap-2 text-xs font-black uppercase tracking-wider text-terra"><ChevronLeft size={17} />Retour au Bilan</Link>
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-terra">Le jeu du crew</p><h1 className="font-display text-4xl font-bold">Challenges</h1></div>
          <button onClick={() => setCreatorOpen(true)} className="tap-bump flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-terra px-4 text-xs font-black text-ivory shadow-card"><CirclePlus size={18} />Créer</button>
        </div>
      </header>

      <div className="grid grid-cols-3 rounded-2xl bg-sand/35 p-1" aria-label="Filtrer les challenges">
        {([["me", "Moi"], ["group", "Groupe"], ["all", "Tous"]] as const).map(([key, label]) => <button key={key} onClick={() => setFilter(key)} aria-pressed={filter === key} className={`min-h-11 rounded-xl text-xs font-black ${filter === key ? "bg-morocco text-ivory shadow-sm" : "text-morocco/55"}`}>{label}</button>)}
      </div>

      <section className="rounded-[28px] bg-morocco p-5 text-ivory shadow-card">
        <div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-2xl bg-sand/15 text-sand"><Sparkles size={20} /></span><div><p className="text-[10px] font-black uppercase tracking-wider text-sand">Bibliothèque</p><h2 className="font-display text-xl font-bold">Choisir un défi</h2></div></div>
        <div className="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {CHALLENGE_PRESETS.map((item) => (
            <button key={item.id} onClick={() => openPreset(item)} className="flex min-h-12 shrink-0 items-center gap-2 rounded-2xl border border-sand/20 bg-white/5 px-4 text-left text-xs font-black text-ivory">
              {item.defaultScope === "group" ? <Users size={14} className="shrink-0 text-sand" /> : null}{item.title}
            </button>
          ))}
        </div>
      </section>

      {sections.map((section) => {
        const items = visible.filter((item) => item.period === section.key && (section.key === "trip" || item.dayKey === today));
        const enriched = items.map((item) => ({ item, progress: calculateChallengeProgress(item, activeParticipants, drinks, drinkEntries, waterEntries, tripPhotos) }));
        const current = enriched.filter(({ item, progress }) => effectiveChallengeStatus(item, progress) === "active");
        const done = enriched.filter(({ item, progress }) => effectiveChallengeStatus(item, progress) === "completed");
        return (
          <section key={section.key} aria-labelledby={`challenge-${section.key}`}>
            <div className="flex items-center justify-between gap-3"><h2 id={`challenge-${section.key}`} className="font-display text-3xl font-bold">{section.title}</h2><span className="shrink-0 rounded-full bg-sand/40 px-3 py-1 text-[10px] font-black uppercase tracking-wider">{current.length} en cours</span></div>
            <div className="mt-3 space-y-3">
              {current.map(({ item, progress }, index) => <ChallengeCard key={item.id} challenge={item} progress={progress} participantName={activeParticipants.find((person) => person.id === item.participantId)?.name ?? null} delay={index * 45} />)}
              {!current.length ? <p className="rounded-2xl border border-dashed border-sand p-5 text-center text-xs font-bold text-morocco/45">Aucun challenge en cours.</p> : null}
            </div>
            {done.length ? <div className="mt-4"><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-terra">Terminés</p><div className="space-y-2">{done.map(({ item, progress }) => <ChallengeCard key={item.id} challenge={item} progress={progress} participantName={activeParticipants.find((person) => person.id === item.participantId)?.name ?? null} done />)}</div></div> : null}
          </section>
        );
      })}

      <section className="rounded-[28px] border border-sand/60 bg-white/80 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-terra/10 text-terra"><Dices size={20} /></span><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-terra">Sans alcool imposé</p><h2 className="font-display text-2xl font-bold">Gages</h2></div></div><button onClick={() => setForfeitOpen(true)} className="tap-bump min-h-11 shrink-0 rounded-xl border-2 border-morocco px-3 text-xs font-black">Tirer</button></div>
        <div className="mt-4 space-y-2">
          {forfeits.filter((item) => !item.deletedAt).map((item) => (
            <div key={item.id} className={`flex items-center gap-3 rounded-2xl p-3 ${item.status === "completed" ? "bg-morocco/10 text-morocco/55" : "bg-sand/30"}`}>
              <Flag size={18} className="shrink-0 text-terra" />
              <div className="min-w-0 flex-1"><p className="text-sm font-black">{item.title}</p><p className="text-[11px] font-bold text-morocco/50">{activeParticipants.find((person) => person.id === item.participantId)?.name ?? "Le groupe"}</p></div>
              {item.status === "pending" ? <button onClick={() => void completeForfeit(item)} className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-morocco text-ivory" aria-label="Marquer le gage comme fait"><Check size={18} /></button> : null}
              <button onClick={() => void deleteForfeit(item)} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-terra" aria-label="Supprimer le gage"><Trash2 size={17} /></button>
            </div>
          ))}
          {!forfeits.filter((item) => !item.deletedAt).length ? <p className="rounded-2xl border border-dashed border-sand p-5 text-center text-xs font-bold text-morocco/45">Aucun gage en cours.</p> : null}
        </div>
      </section>

      <BottomSheet open={Boolean(preset)} onClose={() => setPreset(null)} title={preset?.title ?? "Challenge"}>
        {preset ? (
          <div>
            <div className="rounded-2xl bg-sand/30 p-4">
              <p className="text-sm font-bold">{preset.description}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-black uppercase tracking-wider text-terra">
                <span>{preset.period === "day" ? "Aujourd’hui · 08h à 08h" : "Tout le séjour"}</span>
                <span aria-hidden="true">·</span>
                <span>{preset.defaultScope === "group" ? "Défi de groupe" : "Défi individuel"}</span>
              </p>
            </div>
            {preset.defaultScope === "group" ? (
              <p className="mt-4 flex items-center gap-2 rounded-2xl border border-sand/60 p-4 text-xs font-bold text-morocco/60"><Users size={17} className="shrink-0 text-terra" />Ce défi appartient à tout le crew : il ne s’attribue à personne en particulier.</p>
            ) : (
              <fieldset className="mt-4">
                <legend className="mb-2 text-[10px] font-black uppercase tracking-wider text-terra">Pour qui ?</legend>
                <ParticipantGrid participants={activeParticipants} value={presetFor} onChange={setPresetFor} />
              </fieldset>
            )}
            <button onClick={() => void createPreset(preset)} className="tap-bump mt-5 min-h-14 w-full rounded-2xl bg-terra font-black text-ivory">Ajouter ce défi</button>
          </div>
        ) : null}
      </BottomSheet>
      <ChallengeCreator open={creatorOpen} onClose={() => setCreatorOpen(false)} tripId={trip.id} actorId={actorId} participants={activeParticipants} dayKey={today} />
      <ForfeitCreator open={forfeitOpen} onClose={() => setForfeitOpen(false)} tripId={trip.id} participants={activeParticipants} />
    </div>
  );
}

function ChallengeCard({ challenge, progress, participantName, delay = 0, done = false }: { challenge: Challenge; progress: ReturnType<typeof calculateChallengeProgress>; participantName: string | null; delay?: number; done?: boolean }) {
  const width = `${Math.min(100, Math.round((progress.current / progress.target) * 100))}%`;
  return (
    <article className={`card-enter rounded-[24px] border p-4 shadow-sm ${done ? "border-morocco/25 bg-morocco/5" : "border-sand/60 bg-white/85"}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${done ? "bg-morocco text-ivory" : "bg-terra/10 text-terra"}`}>{done ? <Award size={20} /> : challenge.targetType === "water_count" ? <Droplets size={20} /> : challenge.scope === "group" ? <Users size={20} /> : <Target size={20} />}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 font-display text-xl font-bold leading-tight">{challenge.title}</h3>
            {done ? <span className="shrink-0 rounded-full bg-morocco px-2 py-1 text-[9px] font-black uppercase tracking-wider text-ivory">Terminé</span> : null}
          </div>
          <p className="mt-1 truncate text-xs font-bold text-morocco/50">{challenge.scope === "group" ? "Tout le groupe" : participantName ?? "Non attribué"}</p>
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold leading-relaxed text-morocco/65">{challenge.description}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-sand/40"><div className={`h-full rounded-full transition-[width] duration-500 ${done ? "bg-morocco" : "bg-terra"}`} style={{ width }} /></div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-[11px] font-black text-morocco/60">{progress.label}</p>
        {!progress.automatic && !done ? <button onClick={() => void setChallengeStatus(challenge, "completed")} className="tap-bump min-h-11 shrink-0 rounded-xl bg-morocco px-3 text-[10px] font-black uppercase tracking-wider text-ivory">Marquer réussi</button> : null}
        <button onClick={() => void deleteChallenge(challenge)} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-terra" aria-label="Supprimer le challenge"><Trash2 size={16} /></button>
      </div>
      {challenge.reward ? <p className="mt-2 rounded-xl bg-sand/30 px-3 py-2 text-[11px] font-bold"><Flag size={13} className="mr-1 inline text-terra" />{challenge.reward}</p> : null}
    </article>
  );
}

function ChallengeCreator({ open, onClose, tripId, actorId, participants, dayKey }: { open: boolean; onClose: () => void; tripId: string; actorId: string | null; participants: Participant[]; dayKey: string }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<ChallengeScope>("individual");
  const [period, setPeriod] = useState<ChallengePeriod>("day");
  const [participantId, setParticipantId] = useState<string | null>(actorId);
  const [reward, setReward] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await addChallenge(tripId, {
        title, description, scope, period,
        dayKey: period === "day" ? dayKey : null,
        targetType: "manual", targetValue: 1,
        participantId: scope === "individual" ? participantId ?? actorId : null,
        reward,
      });
      toast({ message: "Challenge créé", detail: title });
      setTitle(""); setDescription(""); setReward("");
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Créer un challenge">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nom"><input required value={title} onChange={(e) => setTitle(e.target.value)} className="min-h-12 w-full rounded-xl border border-sand bg-white px-3" /></Field>
        <Field label="Description / objectif"><textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-xl border border-sand bg-white p-3" /></Field>
        <Segment label="Type" value={scope} onChange={(value) => setScope(value as ChallengeScope)} options={[["individual", "Individuel"], ["group", "Groupe"]]} />
        {scope === "individual" ? (
          <fieldset>
            <legend className="mb-2 text-[10px] font-black uppercase tracking-wider text-terra">Pour qui ?</legend>
            <ParticipantGrid participants={participants} value={participantId} onChange={setParticipantId} />
          </fieldset>
        ) : null}
        <Segment label="Durée" value={period} onChange={(value) => setPeriod(value as ChallengePeriod)} options={[["day", "Aujourd’hui"], ["trip", "Tout le séjour"]]} />
        <Field label="Récompense / gage facultatif"><input value={reward} onChange={(e) => setReward(e.target.value)} className="min-h-12 w-full rounded-xl border border-sand bg-white px-3" /></Field>
        <button disabled={saving} className="tap-bump min-h-14 w-full rounded-2xl bg-terra font-black text-ivory disabled:opacity-50">{saving ? "Création…" : "Créer"}</button>
      </form>
    </BottomSheet>
  );
}

/** Durée totale du tirage : assez pour être lisible, trop court pour ennuyer. */
const DRAW_STEPS = 9;
const DRAW_STEP_MS = 90;

function ForfeitCreator({ open, onClose, tripId, participants }: { open: boolean; onClose: () => void; tripId: string; participants: Participant[] }) {
  const toast = useToast();
  const [step, setStep] = useState<"who" | "pick-person" | "what" | "pick-forfeit">("who");
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [forfeit, setForfeit] = useState<string | null>(null);
  const [rolling, setRolling] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (open) { setStep("who"); setParticipantId(null); setForfeit(null); setRolling(null); }
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, [open]);

  const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  /** Défilement bref des prénoms, puis arrêt sur le tiré au sort. */
  const drawPerson = () => {
    if (!participants.length) return;
    const winner = participants[Math.floor(Math.random() * participants.length)];
    if (reducedMotion()) { setParticipantId(winner.id); setStep("what"); return; }
    timers.current.forEach(clearTimeout);
    timers.current = [];
    for (let index = 0; index < DRAW_STEPS; index += 1) {
      timers.current.push(setTimeout(() => setRolling(participants[index % participants.length].name), index * DRAW_STEP_MS));
    }
    timers.current.push(setTimeout(() => {
      setRolling(winner.name);
      setParticipantId(winner.id);
      timers.current.push(setTimeout(() => { setRolling(null); setStep("what"); }, 650));
    }, DRAW_STEPS * DRAW_STEP_MS));
  };

  const drawForfeit = () => setForfeit(SAFE_FORFEITS[Math.floor(Math.random() * SAFE_FORFEITS.length)]);

  const save = async (title: string) => {
    await addForfeit(tripId, { title, description: "Gage tiré par le crew", participantId, challengeId: null });
    toast({ message: "Gage ajouté", detail: `${title} · ${participants.find((item) => item.id === participantId)?.name ?? "le groupe"}` });
    onClose();
  };

  const personName = participants.find((item) => item.id === participantId)?.name ?? "Le groupe";

  return (
    <BottomSheet open={open} onClose={onClose} title="Tirer un gage">
      {rolling ? (
        <div className="rounded-[24px] bg-morocco p-8 text-center text-ivory">
          <Dices className="mx-auto text-sand" size={28} />
          <p key={rolling} className="draw-flip mt-4 font-display text-3xl font-bold">{rolling}</p>
          <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-sand">Tirage en cours</p>
        </div>
      ) : step === "who" ? (
        <div>
          <p className="text-sm font-bold text-morocco/60">À qui est le gage ?</p>
          <div className="mt-4 grid gap-3">
            <button onClick={drawPerson} className="tap-bump flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-morocco font-black text-ivory"><Dices size={19} />Personne aléatoire</button>
            <button onClick={() => setStep("pick-person")} className="tap-bump flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 border-morocco font-black text-morocco"><Users size={19} />Choisir une personne</button>
          </div>
        </div>
      ) : step === "pick-person" ? (
        <div>
          <p className="text-sm font-bold text-morocco/60">Pour qui ?</p>
          <div className="mt-4"><ParticipantGrid participants={participants} value={participantId} onChange={(id) => { setParticipantId(id); setStep("what"); }} groupLabel="Tout le groupe" /></div>
        </div>
      ) : step === "what" ? (
        <div>
          <p className="rounded-2xl bg-sand/30 p-4 text-sm font-bold">Gage pour <strong className="font-black">{personName}</strong>.</p>
          <p className="mt-4 text-sm font-bold text-morocco/60">Quel gage ?</p>
          <div className="mt-3 grid gap-3">
            <button onClick={() => { drawForfeit(); setStep("pick-forfeit"); }} className="tap-bump flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-terra font-black text-ivory"><Dices size={19} />Gage aléatoire</button>
            <button onClick={() => { setForfeit(null); setStep("pick-forfeit"); }} className="tap-bump flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 border-terra font-black text-terra"><Flag size={19} />Choisir un gage</button>
          </div>
          <button onClick={() => setStep("who")} className="mt-4 min-h-11 w-full text-xs font-black uppercase tracking-wider text-morocco/45">Changer de personne</button>
        </div>
      ) : (
        <div>
          <p className="rounded-2xl bg-sand/30 p-4 text-sm font-bold">Gage pour <strong className="font-black">{personName}</strong>.</p>
          {forfeit ? (
            <>
              <div className="mt-4 rounded-[24px] bg-morocco p-6 text-center text-ivory"><Dices className="mx-auto text-sand" size={26} /><p className="mt-3 font-display text-2xl font-bold">{forfeit}</p></div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button onClick={drawForfeit} className="tap-bump min-h-14 rounded-2xl border-2 border-morocco font-black">Retirer</button>
                <button onClick={() => void save(forfeit)} className="tap-bump min-h-14 rounded-2xl bg-terra font-black text-ivory">Ajouter</button>
              </div>
            </>
          ) : (
            <div className="mt-4 space-y-2">
              {SAFE_FORFEITS.map((item) => (
                <button key={item} onClick={() => void save(item)} className="tap-bump flex min-h-14 w-full items-center gap-3 rounded-2xl border border-sand/60 bg-white px-4 text-left text-sm font-extrabold">
                  <Flag size={16} className="shrink-0 text-terra" /><span className="min-w-0 flex-1">{item}</span>
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setStep("what")} className="mt-4 min-h-11 w-full text-xs font-black uppercase tracking-wider text-morocco/45">Retour</button>
        </div>
      )}
    </BottomSheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-terra">{label}</span>{children}</label>; }
function Segment({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) { return <fieldset><legend className="mb-1 text-[10px] font-black uppercase tracking-wider text-terra">{label}</legend><div className="grid grid-cols-2 rounded-xl bg-sand/35 p-1">{options.map(([key, text]) => <button key={key} type="button" onClick={() => onChange(key)} aria-pressed={value === key} className={`min-h-11 rounded-lg text-xs font-black ${value === key ? "bg-morocco text-ivory" : "text-morocco/55"}`}>{text}</button>)}</div></fieldset>; }

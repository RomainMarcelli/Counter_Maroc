export function EmptyState({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-sand bg-white/45 px-6 py-10 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sand/35 text-terra" aria-hidden="true">{icon}</div>
      <h2 className="mt-3 font-display text-xl font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-morocco/65">{detail}</p>
    </div>
  );
}

import { BrandLogo } from "./brand-logo";

export function BrandLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-morocco text-ivory" role="status" aria-live="polite">
      <div className="text-center">
        <div className="brand-loader-ring mx-auto flex size-24 items-center justify-center rounded-[30px] border border-sand/35 bg-ivory/10">
          <BrandLogo size={72} className="brand-loader-logo rounded-[22px]" priority />
        </div>
        <p className="mt-5 text-sm font-extrabold">Préparation du séjour…</p>
        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-sand">Marrakech Crew</p>
      </div>
    </div>
  );
}

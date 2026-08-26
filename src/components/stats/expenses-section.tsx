"use client";

import { useMemo } from "react";
import { ArrowRight, Wallet } from "lucide-react";
import { useTrip } from "@/components/providers/trip-provider";
import { calculateTripExpenses, formatCents } from "@/domain/expenses";

/** L’addition du séjour : qui a payé, qui a bu, et le plus court chemin pour s’équilibrer. */
export function ExpensesSection() {
  const { trip, participants, drinks, drinkEntries } = useTrip();
  const expenses = useMemo(() => calculateTripExpenses(participants, drinks, drinkEntries), [participants, drinks, drinkEntries]);
  if (!trip || !expenses.pricedEntries) return null;

  return (
    <section>
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-terra/10 text-terra"><Wallet /></span>
        <div><h2 className="font-display text-xl font-bold">L’addition</h2><p className="text-xs font-bold text-morocco/45">{formatCents(expenses.totalCents)} sur {expenses.pricedEntries} verres tarifés</p></div>
      </header>

      <div className="mt-3 space-y-2">
        {expenses.balances.map((balance) => (
          <div key={balance.participantId} className="flex min-h-14 items-center gap-3 rounded-2xl border border-sand/50 bg-white/75 px-4">
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm">{balance.name}</strong>
              <span className="block text-xs font-bold text-morocco/50">a payé {formatCents(balance.paidCents)} · a bu {formatCents(balance.consumedCents)}</span>
            </span>
            <strong className={`shrink-0 text-sm ${balance.balanceCents > 0 ? "text-morocco" : balance.balanceCents < 0 ? "text-terra" : "text-morocco/40"}`}>
              {balance.balanceCents > 0 ? "+" : ""}{formatCents(balance.balanceCents)}
            </strong>
          </div>
        ))}
      </div>

      {expenses.settlements.length ? (
        <div className="mt-3 rounded-3xl bg-morocco p-4 text-ivory">
          <p className="text-[10px] font-black uppercase tracking-wider text-sand">Pour tout équilibrer</p>
          <div className="mt-2 space-y-1.5">
            {expenses.settlements.map((settlement) => (
              <p key={`${settlement.fromId}-${settlement.toId}`} className="flex items-center gap-2 text-sm font-extrabold">
                {settlement.fromName}<ArrowRight size={14} className="shrink-0 text-sand" />{settlement.toName}
                <strong className="ml-auto shrink-0 text-sand">{formatCents(settlement.amountCents)}</strong>
              </p>
            ))}
          </div>
        </div>
      ) : <p className="mt-3 rounded-2xl border border-dashed border-sand p-4 text-sm font-bold text-morocco/60">Tout le monde est à jour, personne ne doit rien.</p>}

      {expenses.unpricedEntries ? <p className="mt-2 text-xs font-bold text-morocco/50">{expenses.unpricedEntries} consommation{expenses.unpricedEntries > 1 ? "s" : ""} sans prix connu {expenses.unpricedEntries > 1 ? "sont exclues" : "est exclue"} du calcul. Renseignez les prix depuis les Réglages.</p> : null}
    </section>
  );
}

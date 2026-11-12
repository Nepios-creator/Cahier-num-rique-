import { ReactNode, useState } from "react";
import { usePremium } from "../../lib/usePremium";
import { startCheckout } from "../../lib/studyApi";

export function PremiumGate({ children }: { children: ReactNode }) {
  const a = usePremium();
  const [busy, setBusy] = useState(false);
  if (a.loading) return <p className="st-muted">Chargement…</p>;
  if (a.hasAccess)
    return (<>
      {a.inTrial && <p className="st-banner">Essai gratuit : encore {a.trialDaysLeft} jour{a.trialDaysLeft > 1 ? "s" : ""}.</p>}
      {children}
    </>);
  return (
    <section className="st-paywall">
      <h2>Ton essai gratuit est terminé</h2>
      <p>Les révisions guidées, l'examen simulé et l'examen blanc de 2 h sont réservés aux abonnés premium.</p>
      <button className="st-btn" disabled={busy} onClick={() => { setBusy(true); startCheckout().catch(() => setBusy(false)); }}>
        {busy ? "Redirection…" : "S'abonner"}
      </button>
    </section>
  );
}

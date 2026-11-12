import { useEffect, useState } from "react";
import { supabase } from "./supabase"; // ⚠️ adapte l'import

export interface Access { loading: boolean; hasAccess: boolean; inTrial: boolean; trialDaysLeft: number; status: string }

export function usePremium(): Access {
  const [a, setA] = useState<Access>({ loading: true, hasAccess: false, inTrial: false, trialDaysLeft: 0, status: "trial" });
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("subscriptions").select("trial_ends_at,status,current_period_end").maybeSingle();
      if (!data) return setA((x) => ({ ...x, loading: false }));
      const now = Date.now();
      const trialLeft = new Date(data.trial_ends_at).getTime() - now;
      const paid = data.status === "active" && new Date(data.current_period_end ?? now).getTime() > now;
      setA({
        loading: false, status: data.status, inTrial: trialLeft > 0 && !paid,
        trialDaysLeft: Math.max(0, Math.ceil(trialLeft / 86_400_000)), hasAccess: trialLeft > 0 || paid,
      });
    })();
  }, []);
  return a;
}

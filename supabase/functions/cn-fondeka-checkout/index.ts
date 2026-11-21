// Edge Function « cn-fondeka-checkout » : lance un paiement mobile money Fondeka (franc congolais ou dollars).
// Déploiement normal (JWT vérifié) :  supabase functions deploy cn-fondeka-checkout
// Formules : m = mensuel (1 mois), t = trimestriel (3 mois), a = annuel (12 mois).
// Secrets : FONDEKA_API_KEY, FONDEKA_BUSINESS_ID.
// Prix (optionnels, valeurs par défaut ci-dessous) : FONDEKA_PRICE = mensuel en FC (4000), FONDEKA_PRICE_3M = trimestriel en FC (10000),
//   FONDEKA_PRICE_12M_USD = annuel en dollars (14). FONDEKA_USD_RATE = taux manuel (FC pour 1 $) ; sinon taux du jour automatique.
// Le montant est fixé ICI : le navigateur ne peut jamais le modifier. L'équivalent dans l'autre devise suit le taux du jour.
import { admin, cors, getUser, json } from "../_shared/cn-common.ts";

const METHODS_CDF = new Set(["AIRTEL_MONEY_DRC_CDF", "MPESA_DRC_CDF", "ORANGE_MONEY_DRC_CDF"]);
const METHODS_USD = new Set(["AIRTEL_MONEY_DRC", "MPESA_DRC", "ORANGE_MONEY_DRC"]);
const PLANS: Record<string, { months: number; base: "CDF" | "USD" }> = {
  m: { months: 1, base: "CDF" },
  t: { months: 3, base: "CDF" },
  a: { months: 12, base: "USD" },
};
const num = (v: string | undefined, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
function baseAmount(p: string): number {
  if (p === "t") return num(Deno.env.get("FONDEKA_PRICE_3M"), 10000);
  if (p === "a") return num(Deno.env.get("FONDEKA_PRICE_12M_USD"), 14);
  return num(Deno.env.get("FONDEKA_PRICE"), 4000);
}
/** Montants d'une formule dans les deux devises (la devise de base est exacte, l'autre suit le taux). */
function amounts(p: string, rate: number | null): { cdf: number | null; usd: number | null } {
  const b = baseAmount(p);
  if (PLANS[p].base === "CDF") return { cdf: b, usd: rate ? Math.ceil((b / rate) * 100) / 100 : null };
  return { usd: b, cdf: rate ? Math.ceil((b * rate) / 100) * 100 : null };
}

let cache: { rate: number; at: number } | null = null;
const sane = (n: number) => Number.isFinite(n) && n > 500 && n < 20000;

/** Francs congolais pour 1 dollar : taux manuel (secret) sinon taux du jour (mis en cache 1 h). */
async function usdRate(): Promise<number | null> {
  const manual = Number(Deno.env.get("FONDEKA_USD_RATE") || "0");
  if (sane(manual)) return manual;
  if (cache && Date.now() - cache.at < 3_600_000) return cache.rate;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch("https://open.er-api.com/v6/latest/USD", { signal: ctl.signal });
    clearTimeout(t);
    const j = await r.json().catch(() => ({}));
    const rate = Number(j?.rates?.CDF);
    if (r.ok && sane(rate)) { cache = { rate, at: Date.now() }; return rate; }
  } catch { /* on essaie le dernier taux connu */ }
  if (cache && Date.now() - cache.at < 86_400_000) return cache.rate;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "non_connecte" }, 401);

    const b = await req.json().catch(() => ({}));

    // Simple affichage des prix (aucun paiement) : { quote: true }
    if (b.quote === true) {
      const rate = await usdRate();
      const plans: Record<string, unknown> = {};
      for (const k of Object.keys(PLANS)) plans[k] = { months: PLANS[k].months, ...amounts(k, rate) };
      return json({ rate, plans });
    }

    const key = Deno.env.get("FONDEKA_API_KEY"), biz = Deno.env.get("FONDEKA_BUSINESS_ID");
    if (!key || !biz || !/^[1-9][0-9]*$/.test(biz)) return json({ error: "fondeka_non_configure" }, 503);

    const phone = String(b.phone || "").replace(/[\s-]/g, "");   // format international : +243...
    const method = String(b.method || "");                       // nom exact du catalogue Fondeka
    const planKey = String(b.plan || "m");
    const code = String(b.ref_code || "").trim().toUpperCase();   // code ambassadeur, facultatif
    if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) return json({ error: "telephone_invalide" }, 400);
    if (!METHODS_CDF.has(method) && !METHODS_USD.has(method)) return json({ error: "moyen_invalide" }, 400);
    if (!PLANS[planKey]) return json({ error: "formule_invalide" }, 400);
    if (code && !/^[A-Z0-9_-]{2,30}$/.test(code)) return json({ error: "code_invalide" }, 400);

    // Devise et montant déduits du moyen et de la formule, jamais envoyés par le navigateur.
    const cur = METHODS_USD.has(method) ? "USD" : "CDF";
    const rate = PLANS[planKey].base === cur ? null : await usdRate();
    if (PLANS[planKey].base !== cur && !rate) return json({ error: "taux_indisponible" }, 503);
    const am = amounts(planKey, rate);
    const price = cur === "USD" ? am.usd : am.cdf;
    if (!price) return json({ error: "erreur", detail: "montant" }, 500);

    const db = admin();
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await db.from("cn_fondeka_payments").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).gte("created_at", since);
    if ((count ?? 0) >= 3) return json({ error: "trop_de_demandes" }, 429);

    const order = "cn-" + crypto.randomUUID().replaceAll("-", "");
    const { data: row, error: e1 } = await db.from("cn_fondeka_payments")
      .insert({
        user_id: user.id, order_reference: order, amount: price, currency: cur,
        months: PLANS[planKey].months, ambassador_code: code || null, phone,
      }).select("id").single();
    if (e1 || !row) return json({ error: "erreur", detail: "enregistrement" }, 500);

    const r = await fetch(`https://api.fondeka.com/business-api/v1/businesses/${biz}/collections`, {
      method: "POST",
      headers: { "X-API-Key": key, "Idempotency-Key": order + ":collection", "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: price, currency: cur, paymentMethodName: method, accountRef: phone,
        orderReference: order, feeApplicationMode: "EXCLUSIVE",
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      await db.from("cn_fondeka_payments").update({ status: "failed" }).eq("id", row.id).eq("status", "pending");
      return json({ error: "fondeka", http: r.status, detail: String(j?.message || j?.error || "").slice(0, 200) }, 502);
    }
    if (typeof j.fondekaReference === "string") {
      await db.from("cn_fondeka_payments").update({ fondeka_reference: j.fondekaReference }).eq("id", row.id).is("fondeka_reference", null);
    }
    // Le client approuve la demande sur son téléphone ; l'activation vient du webhook.
    return json({ order_reference: order, status: j.status ?? "ACCEPTED", amount: price, currency: cur });
  } catch (e) {
    return json({ error: "erreur", detail: String((e as any)?.message || e).slice(0, 200) }, 500);
  }
});

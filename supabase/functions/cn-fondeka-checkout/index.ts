// Edge Function « cn-fondeka-checkout » : lance un paiement mobile money Fondeka (franc congolais ou dollars).
// Déploiement normal (JWT vérifié) :  supabase functions deploy cn-fondeka-checkout
// Secrets : FONDEKA_API_KEY, FONDEKA_BUSINESS_ID ; FONDEKA_PRICE = prix en FRANCS CONGOLAIS (4000 par défaut).
// Optionnel : FONDEKA_USD_RATE = taux manuel (francs pour 1 dollar) ; s'il est absent, le taux du jour est récupéré automatiquement.
// Le montant est fixé ICI : le navigateur ne peut jamais le modifier. Le dollar est calculé : prix en FC / taux du jour.
import { admin, cors, getUser, json } from "../_shared/cn-common.ts";

const METHODS_CDF = new Set(["AIRTEL_MONEY_DRC_CDF", "MPESA_DRC_CDF", "ORANGE_MONEY_DRC_CDF"]);
const METHODS_USD = new Set(["AIRTEL_MONEY_DRC", "MPESA_DRC", "ORANGE_MONEY_DRC"]);

let cache: { rate: number; at: number } | null = null;
const sane = (n: number) => Number.isFinite(n) && n > 500 && n < 20000;

/** Francs congolais pour 1 dollar : taux manuel (secret) sinon taux du jour (mis en cache 1 h). */
async function usdRate(): Promise<{ rate: number; source: string } | null> {
  const manual = Number(Deno.env.get("FONDEKA_USD_RATE") || "0");
  if (sane(manual)) return { rate: manual, source: "manuel" };
  if (cache && Date.now() - cache.at < 3_600_000) return { rate: cache.rate, source: "auto" };
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch("https://open.er-api.com/v6/latest/USD", { signal: ctl.signal });
    clearTimeout(t);
    const j = await r.json().catch(() => ({}));
    const rate = Number(j?.rates?.CDF);
    if (r.ok && sane(rate)) { cache = { rate, at: Date.now() }; return { rate, source: "auto" }; }
  } catch { /* on essaie le dernier taux connu */ }
  if (cache && Date.now() - cache.at < 86_400_000) return { rate: cache.rate, source: "auto" };
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "non_connecte" }, 401);

    const priceCdf = Number(Deno.env.get("FONDEKA_PRICE") || "4000");
    if (!(priceCdf > 0)) return json({ error: "fondeka_non_configure" }, 503);

    const b = await req.json().catch(() => ({}));

    // Simple affichage des prix (aucun paiement) : { quote: true }
    if (b.quote === true) {
      const fx = await usdRate();
      return json({ cdf: priceCdf, usd: fx ? Math.ceil((priceCdf / fx.rate) * 100) / 100 : null, rate: fx?.rate ?? null });
    }

    const key = Deno.env.get("FONDEKA_API_KEY"), biz = Deno.env.get("FONDEKA_BUSINESS_ID");
    if (!key || !biz || !/^[1-9][0-9]*$/.test(biz)) return json({ error: "fondeka_non_configure" }, 503);

    const phone = String(b.phone || "").replace(/[\s-]/g, "");   // format international : +243...
    const method = String(b.method || "");                       // nom exact du catalogue Fondeka
    if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) return json({ error: "telephone_invalide" }, 400);
    if (!METHODS_CDF.has(method) && !METHODS_USD.has(method)) return json({ error: "moyen_invalide" }, 400);

    // Devise et montant déduits du moyen choisi, jamais envoyés par le navigateur.
    let cur = "CDF", price = priceCdf;
    if (METHODS_USD.has(method)) {
      const fx = await usdRate();
      if (!fx) return json({ error: "taux_indisponible" }, 503);
      cur = "USD";
      price = Math.ceil((priceCdf / fx.rate) * 100) / 100;   // arrondi au centime supérieur
    }

    const db = admin();
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await db.from("cn_fondeka_payments").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).gte("created_at", since);
    if ((count ?? 0) >= 3) return json({ error: "trop_de_demandes" }, 429);

    const order = "cn-" + crypto.randomUUID().replaceAll("-", "");
    const { data: row, error: e1 } = await db.from("cn_fondeka_payments")
      .insert({ user_id: user.id, order_reference: order, amount: price, currency: cur }).select("id").single();
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

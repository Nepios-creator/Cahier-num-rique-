// Edge Function « cn-fondeka-checkout » : lance un paiement mobile money Fondeka pour le premium.
// Déploiement normal (JWT vérifié) :  supabase functions deploy cn-fondeka-checkout
// Secrets : FONDEKA_API_KEY, FONDEKA_BUSINESS_ID ; optionnels : FONDEKA_PRICE (5), FONDEKA_CURRENCY (USD).
// Le montant est fixé ICI : le navigateur ne peut jamais le modifier.
import { admin, cors, getUser, json } from "../_shared/cn-common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "non_connecte" }, 401);

    const key = Deno.env.get("FONDEKA_API_KEY"), biz = Deno.env.get("FONDEKA_BUSINESS_ID");
    const price = Number(Deno.env.get("FONDEKA_PRICE") || "5");
    const cur = (Deno.env.get("FONDEKA_CURRENCY") || "USD").toUpperCase();
    if (!key || !biz || !/^[1-9][0-9]*$/.test(biz) || !(price > 0)) return json({ error: "fondeka_non_configure" }, 503);

    const b = await req.json().catch(() => ({}));
    const phone = String(b.phone || "").replace(/[\s-]/g, "");   // format international : +243...
    const method = String(b.method || "");                       // nom exact du catalogue Fondeka (ex. MPESA_KENYA)
    if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) return json({ error: "telephone_invalide" }, 400);
    if (!/^[A-Z0-9_]{3,60}$/.test(method)) return json({ error: "moyen_invalide" }, 400);

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
    return json({ order_reference: order, status: j.status ?? "ACCEPTED" });
  } catch (e) {
    return json({ error: "erreur", detail: String((e as any)?.message || e).slice(0, 200) }, 500);
  }
});

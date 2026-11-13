// Edge Function « cn-checkout » : ouvre une session de paiement Stripe (abonnement).
import { admin, cors, getUser, json } from "../_shared/cn-common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "non_connecte" }, 401);
    const sk = Deno.env.get("STRIPE_SECRET_KEY"), price = Deno.env.get("STRIPE_PRICE_ID");
    if (!sk || !price) return json({ error: "stripe_non_configure" }, 503);
    const b = await req.json().catch(() => ({}));
    const back = String(b.return_url || "");
    if (!/^https:\/\//.test(back)) return json({ error: "return_url_invalide" }, 400);
    const { data: sub } = await admin().from("cn_subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    const f = new URLSearchParams({
      mode: "subscription", "line_items[0][price]": price, "line_items[0][quantity]": "1",
      success_url: back + (back.includes("?") ? "&" : "?") + "premium=ok", cancel_url: back,
      client_reference_id: user.id, "subscription_data[metadata][user_id]": user.id, "metadata[user_id]": user.id,
    });
    if (sub?.stripe_customer_id) f.set("customer", sub.stripe_customer_id);
    else if (user.email) f.set("customer_email", user.email);
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST", headers: { Authorization: `Bearer ${sk}`, "Content-Type": "application/x-www-form-urlencoded" }, body: f,
    });
    const j = await r.json();
    if (!r.ok) return json({ error: "stripe", detail: j?.error?.message }, 502);
    return json({ url: j.url });
  } catch (e) {
    return json({ error: "erreur", detail: String((e as any)?.message || e).slice(0, 200) }, 500);
  }
});

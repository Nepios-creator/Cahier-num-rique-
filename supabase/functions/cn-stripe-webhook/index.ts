// Edge Function « cn-stripe-webhook » — à déployer avec --no-verify-jwt (Stripe n'envoie pas de jeton Supabase).
// La signature Stripe est vérifiée ici avec STRIPE_WEBHOOK_SECRET.
import { admin } from "../_shared/cn-common.ts";

const enc = new TextEncoder();
async function verify(raw: string, header: string, secret: string) {
  const p = Object.fromEntries(header.split(",").map((x) => x.split("=") as [string, string]));
  const t = p["t"], v1 = header.split(",").filter((x) => x.startsWith("v1=")).map((x) => x.slice(3));
  if (!t || !v1.length || Math.abs(Date.now() / 1000 - Number(t)) > 600) return false;
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(`${t}.${raw}`))))
    .map((x) => x.toString(16).padStart(2, "0")).join("");
  return v1.includes(sig);
}
const stripe = (path: string) =>
  fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}` } }).then((r) => r.json());

async function apply(userId: string | null, s: any) {
  const db = admin();
  const status = s.status === "active" || s.status === "trialing" ? "active" : s.status === "past_due" ? "past_due" : "canceled";
  const patch = {
    status, stripe_customer_id: s.customer, stripe_subscription_id: s.id,
    current_period_end: new Date((s.current_period_end ?? s.items?.data?.[0]?.current_period_end) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (userId) await db.from("cn_subscriptions").upsert({ user_id: userId, ...patch });
  else await db.from("cn_subscriptions").update(patch).eq("stripe_subscription_id", s.id);
}

Deno.serve(async (req) => {
  const raw = await req.text();
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret || !(await verify(raw, req.headers.get("stripe-signature") || "", secret))) return new Response("signature", { status: 400 });
  try {
    const ev = JSON.parse(raw), o = ev.data.object;
    if (ev.type === "checkout.session.completed" && o.subscription) {
      await apply(o.client_reference_id || o.metadata?.user_id || null, await stripe(`subscriptions/${o.subscription}`));
    } else if (ev.type === "customer.subscription.updated" || ev.type === "customer.subscription.deleted") {
      await apply(o.metadata?.user_id || null, ev.type.endsWith("deleted") ? { ...o, status: "canceled" } : o);
    }
    return new Response("ok");
  } catch (e) {
    return new Response("erreur " + String((e as any)?.message || e), { status: 500 });
  }
});

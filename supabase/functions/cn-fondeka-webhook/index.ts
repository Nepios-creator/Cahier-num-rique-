// Edge Function « cn-fondeka-webhook » : reçoit les notifications de paiement Fondeka.
// Déploiement : supabase functions deploy cn-fondeka-webhook --no-verify-jwt  (Fondeka n'envoie pas de jeton Supabase).
// Authenticité vérifiée ICI (HMAC-SHA256 sur « timestamp.corps_brut »).
// Secrets : FONDEKA_WEBHOOK_SECRET ; optionnel : FONDEKA_EXPECTED_ENV (LIVE par défaut).
// Si le paiement porte un code ambassadeur, la vente est enregistrée côté ADG (au mieux : un échec n'empêche jamais l'activation).
import { admin } from "../_shared/cn-common.ts";

const enc = new TextEncoder();
const ok = (t: string) => new Response(t, { status: 200 });

const ADG_URL = "https://kearpnvypzztnnltmrpp.supabase.co";
const ADG_KEY = "sb_publishable_whfpzyuXH1Qup_q2h5wPdg_QY9uKqpA";

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function sign(secret: string, timestamp: string, raw: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prefix = enc.encode(timestamp + ".");
  const msg = new Uint8Array(prefix.length + raw.length);
  msg.set(prefix, 0);
  msg.set(raw, prefix.length);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, msg)))
    .map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Lie le paiement à l'ambassadeur dans ADG (même fonction que l'application : register_sale). Résultat noté dans adg_status. */
async function adgRegister(db: ReturnType<typeof admin>, pay: any) {
  try {
    const { data: u } = await db.auth.admin.getUserById(pay.user_id);
    const r = await fetch(`${ADG_URL}/rest/v1/rpc/register_sale`, {
      method: "POST",
      headers: { apikey: ADG_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_ref_code: pay.ambassador_code, p_app_name: "Cahier numérique",
        p_client_name: u?.user?.email ?? "Client", p_client_phone: pay.phone ?? "",
        p_method: "mobile_money", p_amount: null, p_proof_url: "fondeka:" + pay.order_reference,
      }),
    });
    const t = await r.text();
    await db.from("cn_fondeka_payments").update(
      r.ok ? { adg_status: "ok", adg_sale: t.replace(/"/g, "").slice(0, 64) } : { adg_status: ("erreur " + r.status + " " + t).slice(0, 200) },
    ).eq("id", pay.id);
  } catch (e) {
    try { await db.from("cn_fondeka_payments").update({ adg_status: "erreur reseau" }).eq("id", pay.id); } catch { /* rien */ }
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("methode", { status: 405 });
  const secret = Deno.env.get("FONDEKA_WEBHOOK_SECRET");
  const expectedEnv = (Deno.env.get("FONDEKA_EXPECTED_ENV") || "LIVE").toUpperCase();
  if (!secret) return new Response("non_configure", { status: 503 });

  // 1) Corps BRUT (avant tout JSON.parse) + authentification
  const raw = new Uint8Array(await req.arrayBuffer());
  if (raw.length > 1_048_576) return new Response("trop_gros", { status: 413 });
  const ts = req.headers.get("x-fondeka-timestamp") || "";
  const sig = req.headers.get("x-fondeka-signature") || "";
  const eventId = req.headers.get("x-fondeka-event-id") || "";
  if (!/^[0-9]{1,12}$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300 || !/^v1=[a-f0-9]{64}$/.test(sig)) {
    return new Response("auth", { status: 400 });
  }
  if (!safeEqual(await sign(secret, ts, raw), sig.slice(3))) return new Response("auth", { status: 400 });

  // 2) Événement authentique : on le valide. Les cas inutilisables renvoient 200 (inutile de rejouer 10 fois).
  let ev: any;
  try { ev = JSON.parse(new TextDecoder().decode(raw)); } catch { return ok("json_ignore"); }
  const d = ev?.data ?? {};
  const st = typeof d.status === "string" ? d.status : "";
  if (
    ev?.id !== eventId || ev?.environment !== expectedEnv || d.environment !== expectedEnv ||
    d.service !== "BUSINESS_API" || d.action !== "BUSINESS_API_COLLECTION" ||
    !/^(COMPLETED|FAILED)$/.test(st) || ev?.type !== `business_api.collection.${st.toLowerCase()}`
  ) return ok("ignore");

  const order = typeof d.orderReference === "string" ? d.orderReference : "";
  const fref = typeof d.fondekaReference === "string" ? d.fondekaReference.trim() : "";
  if (!/^cn-[a-f0-9]{32}$/.test(order) || !fref) return ok("ignore");

  try {
    const db = admin();
    const { data: pay, error } = await db.from("cn_fondeka_payments").select("*").eq("order_reference", order).maybeSingle();
    if (error) return new Response("db", { status: 500 }); // Fondeka rejouera
    if (!pay) return ok("inconnu");
    if (pay.fondeka_reference && pay.fondeka_reference !== fref) { console.error("reference differente", order); return ok("reference"); }

    if (st === "FAILED") {
      await db.from("cn_fondeka_payments").update({ status: "failed", fondeka_reference: pay.fondeka_reference ?? fref }).eq("id", pay.id).eq("status", "pending");
      return ok("echec_enregistre");
    }

    // 3) Ne jamais activer sans avoir vérifié la devise et le montant NET attendus.
    if (String(d.currency || "").toUpperCase() !== pay.currency || Number(d.amount) !== Number(pay.amount)) {
      console.error("montant ou devise inattendus", order, d.amount, d.currency);
      return ok("montant");
    }

    // 4) Paiement validé + accès prolongé, en une transaction idempotente.
    const { data: res, error: e2 } = await db.rpc("cn_fondeka_complete", { p_order: order, p_fondeka_ref: fref, p_event: eventId });
    if (e2) return new Response("db", { status: 500 });

    // 5) Lien ambassadeur (une seule fois, au premier traitement), sans jamais bloquer la réponse à Fondeka.
    if (res === "applique" && pay.ambassador_code) await adgRegister(db, pay);
    return ok(String(res));
  } catch (e) {
    console.error("webhook", String((e as any)?.message || e).slice(0, 200));
    return new Response("erreur", { status: 500 });
  }
});

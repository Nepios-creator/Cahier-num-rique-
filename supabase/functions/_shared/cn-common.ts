// Utilitaires communs aux fonctions « cn-etude », « cn-checkout » et « cn-stripe-webhook ».
import { createClient } from "jsr:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

export const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

/** Identifie l'utilisateur depuis son jeton (ne fait jamais confiance au corps de la requête). */
export async function getUser(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  return error || !data.user ? null : data.user;
}

/** Même règle que « cn-ia » : le compte doit être validé par l'administration. */
export async function isValidated(uid: string): Promise<boolean> {
  const { data } = await admin().from("cn_profils").select("statut").eq("user_id", uid).maybeSingle();
  return data?.statut === "valide";
}

/** Le premium est vérifié ICI, côté serveur : le contourner côté navigateur ne sert à rien. */
export async function hasPremium(uid: string): Promise<boolean> {
  const { data } = await admin().rpc("cn_has_premium_access", { uid });
  return data === true;
}

/** Appel à l'API Mistral (clé dans le secret MISTRAL_API_KEY, jamais dans le code). */
export async function mistral(system: string, user: string, opts: { json?: boolean; max?: number } = {}) {
  const key = Deno.env.get("MISTRAL_API_KEY");
  if (!key) throw new Error("no_key");
  const model = Deno.env.get("MISTRAL_MODEL") || "mistral-large-latest";
  const body: Record<string, unknown> = {
    model, temperature: 0.2, max_tokens: opts.max ?? 6000,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  };
  if (opts.json) body.response_format = { type: "json_object" };
  let last = "";
  for (let i = 0; i < 2; i++) {
    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      const j = await r.json();
      // Mistral peut renvoyer le contenu en blocs [{type:"text",text:"…"}] : on les met bout à bout.
      const c = j.choices?.[0]?.message?.content;
      if (Array.isArray(c)) {
        return c.map((x: any) => (typeof x === "string" ? x : String(x?.text ?? x?.content ?? ""))).join("");
      }
      return String(c ?? "");
    }
    last = `mistral_${r.status}`;
    if (r.status !== 429 && r.status < 500) break;
    await new Promise((s) => setTimeout(s, 1500));
  }
  throw new Error(last || "mistral_error");
}

export function parseJson(t: string) {
  const s = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(s); } catch { /* essaie d'extraire l'objet */ }
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
  throw new Error("json_invalide");
}

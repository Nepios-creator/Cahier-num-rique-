// Edge Function « cn-langue » : résumé ou explication d'un cours en lingala, swahili, anglais (ou français).
// POST { mode: "resume"|"simple", lang: "fr"|"ln"|"sw"|"en", titre?, texte, vocab? }  ->  { texte }
// Réservé aux abonnés. Se base UNIQUEMENT sur le texte envoyé.
import { cors, getUser, hasPremium, isValidated, json, mistral } from "../_shared/cn-common.ts";

const LANGS: Record<string, string> = { fr: "français", ln: "lingala", sw: "swahili", en: "anglais" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "non_connecte" }, 401);
    if (!(await isValidated(user.id))) return json({ error: "non_valide" }, 403);
    if (!(await hasPremium(user.id))) return json({ error: "premium_required" }, 402);
    const b = await req.json();
    const lang = LANGS[b.lang] ? String(b.lang) : "fr";
    const texte = String(b.texte || "").trim().slice(0, 14000);
    if (texte.length < 80) return json({ error: "texte_trop_court" }, 400);
    const vocab = String(b.vocab || "").slice(0, 800);
    const simple = b.mode === "simple";
    const sys = `Tu aides un étudiant congolais à réviser. À partir du TEXTE du cours fourni (et de lui seul, sans rien inventer), ${simple ? "explique-le simplement, comme à un camarade, avec des mots courts et un exemple tiré du texte" : "rédige un résumé fidèle et structuré (idées clés en courts paragraphes ou tirets)"}.
Rédige en ${LANGS[lang]}. Conserve entre parenthèses les termes techniques d'origine (médicaux, juridiques) lorsque la traduction n'est pas courante.${vocab ? `\nTermes du cours à respecter tels quels : ${vocab}` : ""}
Si tu n'es pas sûr d'une tournure en ${LANGS[lang]}, préfère une phrase simple et claire plutôt qu'une traduction approximative. Texte brut uniquement.`;
    const out = await mistral(sys, `TITRE : ${String(b.titre || "").slice(0, 120)}\n\nTEXTE :\n${texte}`, { max: 1800 });
    const t = String(out || "").trim();
    if (!t) throw new Error("reponse_vide");
    return json({ texte: t });
  } catch (e) {
    const m = String((e as any)?.message || e);
    return json({ error: m === "no_key" ? "no_key" : "erreur", detail: m.slice(0, 200) }, m === "no_key" ? 503 : 500);
  }
});

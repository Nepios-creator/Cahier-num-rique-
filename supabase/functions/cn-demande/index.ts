// Edge Function « cn-demande » : « Demande à ton cahier ».
// Répond UNIQUEMENT à partir des passages du cahier envoyés par l'application (notes, transcriptions d'audios),
// avec renvoi vers la source. Texte uniquement. Limite : 10 réponses par jour et par cahier (appliquée ICI, côté serveur).
// POST { notebook_id, question, mode: "repondre"|"simple", lang: "fr"|"ln"|"sw"|"en", passages: [{id,label,text}], peek?: true }
import { admin, cors, getUser, hasPremium, isValidated, json, mistral } from "../_shared/cn-common.ts";

const MAX_PAR_JOUR = 10;
const LANGS: Record<string, string> = { fr: "français", ln: "lingala", sw: "swahili", en: "anglais" };

const SYS = (lang: string, simple: boolean) => `Tu es l'assistant d'un cahier de cours. Tu réponds UNIQUEMENT avec les PASSAGES fournis (notes de l'étudiant et transcriptions des cours audio).
Règles strictes :
- N'utilise AUCUNE connaissance extérieure. Si les passages ne contiennent pas la réponse, réponds exactement : "Je ne trouve pas cela dans votre cahier." avec "sources": [].
- Si les passages ne répondent qu'en partie, dis clairement ce qui manque.
- Chaque affirmation doit venir d'un passage : cite-les par leur identifiant, par exemple [P1], [A2].
- Texte brut uniquement (pas de tableau, pas d'image). Phrases courtes.
${simple ? "- Explique comme à un camarade de première année : mots simples, un exemple concret tiré du cahier si possible, sans jargon non expliqué." : "- Reste précis et fidèle aux termes du cours."}
- Rédige la réponse en ${LANGS[lang] || "français"}. Garde les termes techniques du cours (médicaux, juridiques) entre parenthèses dans leur forme d'origine.
Réponds par UN objet JSON : {"answer": string, "sources": [identifiants réellement utilisés]}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "non_connecte" }, 401);
    if (!(await isValidated(user.id))) return json({ error: "non_valide" }, 403);
    if (!(await hasPremium(user.id))) return json({ error: "premium_required" }, 402);
    const b = await req.json();
    const db = admin();
    const nb = String(b.notebook_id || "").slice(0, 80);
    if (!nb) return json({ error: "cahier_manquant" }, 400);

    if (b.peek) {   // simple consultation du nombre de réponses restantes
      const { data } = await db.rpc("cn_demande_restant", { p_user: user.id, p_nb: nb, p_max: MAX_PAR_JOUR });
      return json({ restant: data ?? MAX_PAR_JOUR, max: MAX_PAR_JOUR });
    }

    const question = String(b.question || "").trim().slice(0, 600);
    if (question.length < 3) return json({ error: "question_vide" }, 400);
    const lang = LANGS[b.lang] ? String(b.lang) : "fr";
    const passages = (Array.isArray(b.passages) ? b.passages : []).slice(0, 14)
      .map((p: any) => ({ id: String(p.id || "").slice(0, 12), label: String(p.label || "").slice(0, 120), text: String(p.text || "").slice(0, 3500) }))
      .filter((p) => p.id && p.text.trim());
    if (!passages.length) return json({ error: "cahier_vide" }, 400);

    // Rien à envoyer à l'IA si le cahier ne contient rien : on ne consomme pas de réponse.
    const { data: n, error: e1 } = await db.rpc("cn_demande_prendre", { p_user: user.id, p_nb: nb, p_max: MAX_PAR_JOUR });
    if (e1) throw e1;
    if (n === -1) return json({ error: "limite_atteinte", restant: 0, max: MAX_PAR_JOUR }, 429);

    try {
      const raw = await mistral(SYS(lang, b.mode === "simple"),
        `PASSAGES :\n${passages.map((p) => `[${p.id}] ${p.label}\n${p.text}`).join("\n\n")}\n\nQUESTION : ${question}`,
        { json: true, max: 1500 });
      let o: any;
      try { o = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim()); }
      catch { const a = raw.indexOf("{"), z = raw.lastIndexOf("}"); o = JSON.parse(raw.slice(a, z + 1)); }
      const ids = new Set(passages.map((p) => p.id));
      // On ne garde que des sources qui existent vraiment : jamais de renvoi inventé.
      const sources = (Array.isArray(o.sources) ? o.sources : []).map(String).filter((s: string) => ids.has(s));
      const answer = String(o.answer || "").trim();
      if (!answer) throw new Error("reponse_vide");
      return json({ answer, sources, restant: Math.max(MAX_PAR_JOUR - n, 0), max: MAX_PAR_JOUR });
    } catch (err) {
      await db.rpc("cn_demande_rendre", { p_user: user.id, p_nb: nb });   // échec : la réponse n'est pas décomptée
      throw err;
    }
  } catch (e) {
    const m = String((e as any)?.message || e);
    return json({ error: m === "no_key" ? "no_key" : "erreur", detail: m.slice(0, 200) }, m === "no_key" ? 503 : 500);
  }
});

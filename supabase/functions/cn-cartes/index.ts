// Edge Function « cn-cartes » : questions de révision « type examen » générées à partir des notes de l'étudiant (abonnés).
// POST { notebook_id, cours?, lang?, count?: 4..10, passages: [{id,label,text}] } -> { cards: [{ q, a, src }], restant, max }
// Les réponses ne viennent que des passages envoyés. Plafond : 10 générations par jour (compteur « cartes »). Administrateurs : illimité.
import { admin, cors, getUser, hasPremium, isValidated, json, mistral } from "./cn-common.ts";

const MAX_PAR_JOUR = 10;
const LANGS: Record<string, string> = { fr: "français", ln: "lingala", sw: "swahili", en: "anglais" };
const parse = (raw: string) => {
  const t = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(t); } catch { const a = t.indexOf("{"), z = t.lastIndexOf("}"); return JSON.parse(t.slice(a, z + 1)); }
};
const S = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

const SYS = (lang: string, n: number, cours: string) => `Tu es un enseignant d'université (système LMD, RDC) qui prépare des cartes de révision pour un étudiant${cours ? ` du cours « ${cours} »` : ""}, à partir de SES NOTES uniquement.
Écris ${n} questions comme celles d'un examen écrit : elles testent la COMPRÉHENSION du contenu, pas la mémoire d'un mot isolé.
Varie les types : définir un concept ; expliquer pourquoi/comment ; comparer ou distinguer deux notions ; énumérer (« Citez… ») ; donner le rôle, la condition ou la conséquence ; une courte mise en situation SEULEMENT si les notes permettent d'y répondre.
Règles strictes :
- Chaque question est autonome et entière : elle nomme le sujet précis (jamais « selon le texte », « dans cette phrase », « ce paragraphe », jamais un texte à trous).
- La réponse modèle (2 à 4 phrases) vient UNIQUEMENT des notes : pas de connaissance extérieure, pas d'invention. Si les notes ne permettent pas de bonnes questions sur un passage, passe-le.
- Pas de question sur des détails sans intérêt (dates sans enjeu, mots de liaison, numéros de page).
- "src" = identifiant du passage principal utilisé (ex. "P3" ou "A2").
- Rédige en ${LANGS[lang] || "français"}, avec les termes techniques du cours.
Réponds par UN objet JSON : {"cards":[{"q":string,"a":string,"src":string}]}`;

async function estAdmin(uid: string): Promise<boolean> {
  const { data } = await admin().from("cn_profils").select("est_admin").eq("user_id", uid).maybeSingle();
  return data?.est_admin === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "non_connecte" }, 401);
    const adm = await estAdmin(user.id);
    if (!adm && !(await isValidated(user.id))) return json({ error: "non_valide" }, 403);
    if (!adm && !(await hasPremium(user.id))) return json({ error: "premium_required" }, 402);
    const b = await req.json();
    const lang = LANGS[b.lang] ? String(b.lang) : "fr";
    const n = Math.min(10, Math.max(4, Number(b.count) || 8));
    const passages = (Array.isArray(b.passages) ? b.passages : []).slice(0, 30)
      .map((p: any) => ({ id: S(p.id, 12), label: S(p.label, 140), text: S(p.text, 1100) })).filter((p) => p.id && p.text);
    if (!passages.length) return json({ error: "cahier_vide" }, 400);

    const db = admin();
    let used = 0;
    if (!adm) {
      const r = await db.rpc("cn_demande_prendre", { p_user: user.id, p_nb: "cartes", p_max: MAX_PAR_JOUR });
      if (r.error) throw r.error;
      used = r.data;
      if (used === -1) return json({ error: "limite_atteinte", max: MAX_PAR_JOUR }, 429);
    }
    try {
      const raw = await mistral(SYS(lang, n, S(b.cours, 120)),
        `NOTES DE L'ÉTUDIANT :\n${passages.map((p) => `[${p.id}] ${p.label}\n${p.text}`).join("\n\n")}`,
        { json: true, max: 3000 });
      const o = parse(raw);
      const ids = new Set(passages.map((p) => p.id));
      const seen = new Set<string>();
      const cards = (Array.isArray(o.cards) ? o.cards : []).map((c: any) => ({ q: S(c.q, 320), a: S(c.a, 800), src: ids.has(S(c.src, 12)) ? S(c.src, 12) : passages[0].id }))
        .filter((c: any) => c.q.length >= 15 && c.a.length >= 8 && !/selon (le|ce) (texte|passage)|dans cette phrase|_{3,}/i.test(c.q))
        .filter((c: any) => { const k = c.q.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
        .slice(0, n);
      if (!cards.length) throw new Error("reponse_vide");
      return json({ cards, restant: adm ? -1 : Math.max(MAX_PAR_JOUR - used, 0), max: adm ? -1 : MAX_PAR_JOUR, illimite: adm });
    } catch (err) {
      if (!adm) await db.rpc("cn_demande_rendre", { p_user: user.id, p_nb: "cartes" });
      throw err;
    }
  } catch (e) {
    const m = String((e as any)?.message || e);
    return json({ error: m === "no_key" ? "no_key" : "erreur", detail: m.slice(0, 200) }, m === "no_key" ? 503 : 500);
  }
});

// Edge Function « cn-tfc » : assistant TFC / mémoire / exposé (réservé aux abonnés).
// POST { mode: "plan"|"reformuler"|"expose", sujet?, niveau?, texte?, ton?, lang?, passages?: [{id,label,text}] }
//   plan       -> { plan: [{ titre, sous: [string] }], conseils: [string] }
//   reformuler -> { texte }
//   expose     -> { slides: [{ titre, points: [string], notes, sources: [ids] }] }
// Les passages viennent des notes de l'étudiant ; aucune référence bibliographique n'est inventée (la bibliographie est
// mise en forme côté application, à partir de ce que l'étudiant saisit). Plafond : 20 appels par jour (compteur partagé « tfc »).
import { admin, cors, getUser, hasPremium, isValidated, json, mistral } from "../_shared/cn-common.ts";

const MAX_PAR_JOUR = 20;
const LANGS: Record<string, string> = { fr: "français", ln: "lingala", sw: "swahili", en: "anglais" };
const parse = (raw: string) => {
  const t = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(t); } catch { const a = t.indexOf("{"), z = t.lastIndexOf("}"); return JSON.parse(t.slice(a, z + 1)); }
};
const S = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const arr = (v: unknown, n: number, m: number) => (Array.isArray(v) ? v : []).map((x) => S(x, m)).filter(Boolean).slice(0, n);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "non_connecte" }, 401);
    if (!(await isValidated(user.id))) return json({ error: "non_valide" }, 403);
    if (!(await hasPremium(user.id))) return json({ error: "premium_required" }, 402);
    const b = await req.json();
    const mode = ["plan", "reformuler", "expose"].includes(b.mode) ? String(b.mode) : "";
    if (!mode) return json({ error: "mode_inconnu" }, 400);
    const lang = LANGS[b.lang] ? String(b.lang) : "fr";
    const sujet = S(b.sujet, 300), niveau = S(b.niveau, 80);
    const passages = (Array.isArray(b.passages) ? b.passages : []).slice(0, 26)
      .map((p: any) => ({ id: S(p.id, 12), label: S(p.label, 140), text: S(p.text, 1100) })).filter((p) => p.id && p.text);
    const texte = S(b.texte, 6000);
    if (mode === "reformuler" ? texte.length < 20 : (sujet.length < 4)) return json({ error: mode === "reformuler" ? "texte_trop_court" : "sujet_vide" }, 400);
    if (mode === "expose" && !passages.length) return json({ error: "cahier_vide" }, 400);

    const db = admin();
    const { data: n, error: e1 } = await db.rpc("cn_demande_prendre", { p_user: user.id, p_nb: "tfc", p_max: MAX_PAR_JOUR });
    if (e1) throw e1;
    if (n === -1) return json({ error: "limite_atteinte", max: MAX_PAR_JOUR }, 429);
    try {
      const ctx = passages.length ? `NOTES DE L'ÉTUDIANT :\n${passages.map((p) => `[${p.id}] ${p.label}\n${p.text}`).join("\n\n")}` : "";
      let out: unknown;
      if (mode === "plan") {
        const sys = `Tu aides un étudiant congolais de dernière année à structurer son travail de fin de cycle (TFC) / mémoire. Réponds en ${LANGS[lang]}.
Propose un plan détaillé et réaliste adapté au sujet${niveau ? ` et au niveau (${niveau})` : ""} : introduction (contexte, problématique, hypothèses, objectifs, méthodes, délimitation), 2 à 4 chapitres avec sections, conclusion.
Appuie-toi sur les NOTES fournies quand elles existent, sans leur faire dire autre chose. N'invente AUCUNE référence, AUCUN auteur, AUCUN chiffre.
Réponds par UN objet JSON : {"plan":[{"titre":string,"sous":[string]}],"conseils":[3 à 5 conseils courts de méthode]}`;
        const o = parse(await mistral(sys, `SUJET : ${sujet}\n\n${ctx}`, { json: true, max: 2200 }));
        const plan = (Array.isArray(o.plan) ? o.plan : []).slice(0, 14).map((c: any) => ({ titre: S(c.titre, 160), sous: arr(c.sous, 10, 200) })).filter((c: any) => c.titre);
        if (!plan.length) throw new Error("reponse_vide");
        out = { plan, conseils: arr(o.conseils, 6, 240) };
      } else if (mode === "reformuler") {
        const sys = `Tu reformules le texte de l'étudiant en ${LANGS[lang]}, dans un style ${S(b.ton, 30) === "simple" ? "simple et clair" : "académique, sobre et précis"}.
Règles strictes : garde exactement le même sens ; n'ajoute aucune information, aucune référence, aucune citation, aucun chiffre ; conserve les termes techniques et les noms propres ; ne fais pas plus long que l'original de plus d'un quart. Texte brut uniquement, sans commentaire.`;
        const t = S(await mistral(sys, texte, { max: 1800 }), 8000);
        if (!t) throw new Error("reponse_vide");
        out = { texte: t };
      } else {
        const sys = `Tu prépares la présentation orale (exposé) d'un étudiant, en ${LANGS[lang]}, À PARTIR DES NOTES fournies et d'elles seules.
Fais 6 à 12 diapositives : titre, introduction/plan, développement (une idée par diapo), conclusion. Chaque diapo : un titre court, 2 à 4 points très courts (pas de phrases longues), et des "notes" d'orateur (2 à 3 phrases à dire à l'oral).
Cite dans "sources" les identifiants des notes réellement utilisées. N'invente rien : si les notes ne couvrent pas un point, ne le traite pas.
Réponds par UN objet JSON : {"slides":[{"titre":string,"points":[string],"notes":string,"sources":[identifiants]}]}`;
        const o = parse(await mistral(sys, `SUJET DE L'EXPOSÉ : ${sujet}\n\n${ctx}`, { json: true, max: 3200 }));
        const ids = new Set(passages.map((p) => p.id));
        const slides = (Array.isArray(o.slides) ? o.slides : []).slice(0, 14).map((s: any) => ({
          titre: S(s.titre, 120), points: arr(s.points, 5, 180), notes: S(s.notes, 600),
          sources: (Array.isArray(s.sources) ? s.sources : []).map(String).filter((x: string) => ids.has(x)),   // jamais de source inventée
        })).filter((s: any) => s.titre);
        if (!slides.length) throw new Error("reponse_vide");
        out = { slides };
      }
      return json({ ...(out as object), restant: Math.max(MAX_PAR_JOUR - n, 0), max: MAX_PAR_JOUR });
    } catch (err) {
      await db.rpc("cn_demande_rendre", { p_user: user.id, p_nb: "tfc" });   // échec : l'appel n'est pas décompté
      throw err;
    }
  } catch (e) {
    const m = String((e as any)?.message || e);
    return json({ error: m === "no_key" ? "no_key" : "erreur", detail: m.slice(0, 200) }, m === "no_key" ? 503 : 500);
  }
});

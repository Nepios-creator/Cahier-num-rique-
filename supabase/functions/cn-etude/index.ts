// Edge Function « cn-etude » : révision, génération d'examen, correction.
// POST { action: "revision"|"exam"|"grade", ... } avec le jeton de l'utilisateur.
// Le contenu du cahier (notes, transcriptions, documents, légendes de dessins) est envoyé par l'application,
// car audios, transcriptions et documents sont stockés sur l'appareil (pas dans la base).
import { admin, cors, getUser, hasPremium, isValidated, json, mistral, parseJson } from "../_shared/cn-common.ts";

const MAX = 120_000;
const BASE = `Tu es un professeur rigoureux. Tu t'appuies UNIQUEMENT sur le contenu du cahier fourni
(notes, audios transcrits, documents téléversés, légendes de dessins). N'invente aucun fait absent du cahier ;
si une notion est incomplète, dis-le. Réponds en français. Écris les formules en LaTeX entre $...$ ou $$...$$ (chimie : \\ce{...}).`;

const REV: Record<string, string> = {
  general: `${BASE}
Produis une RÉVISION GÉNÉRALE de tout le cahier en Markdown : 1) Vue d'ensemble et plan ; 2) Synthèse chapitre par chapitre ;
3) Définitions et notions clés ; 4) Formules/schémas importants ; 5) Points à retenir absolument ; 6) 10 questions d'auto-test (sans réponses).`,
  approfondie: `${BASE}
Produis une RÉVISION APPROFONDIE en Markdown, destinée aussi à être LUE À VOIX HAUTE (phrases claires, peu de tableaux).
Explique en mots simples tout le langage juridique ou technique (terme → sens → exemple concret), relie les notions entre elles,
signale les pièges fréquents, puis termine par un glossaire et un résumé de 10 lignes.`,
};

const EXAM_SYS = `${BASE}
Tu crées un examen FIDÈLE au cahier (même niveau, mêmes notions, même vocabulaire). Réponds par UN objet JSON :
{"title":string,"questions":[{"id":"q1","type":"qcm|vrai_faux|definition|ouverte|dissertation|cas_pratique|raisonnement","points":number,"text":string,"choices":[string] (qcm seulement, 4 choix)}],
 "answer_key":[{"id":"q1","answer": (qcm: index 0-3 ; vrai_faux: true/false ; autres: réponse modèle rédigée),"explanation":string,"notion":string,"criteria":[string]}]}
Mélange tous les types. Le total des points doit faire exactement 20.`;

const clip = (s: unknown) => String(s ?? "").slice(0, MAX);

// Une réponse unique de 16 à 20 questions est coupée par la limite de longueur : l'examen blanc est donc généré
// en deux parties parallèles (A : questions courtes, B : questions longues), puis fusionné.
async function genPart(want: string, content: string, prefix: string, max: number) {
  let last: unknown;
  for (let t = 0; t < 2; t++) {
    try {
      const o = parseJson(await mistral(EXAM_SYS,
        `${want}\nIdentifiants des questions : ${prefix}1, ${prefix}2, …\n\nCONTENU DU CAHIER :\n${content}`, { json: true, max }));
      const map: Record<string, string> = {};
      const questions = (o.questions || []).map((q: any, n: number) => { const id = prefix + (n + 1); map[String(q.id ?? "")] = id; return { ...q, id }; });
      const answer_key = (o.answer_key || []).map((k: any) => ({ ...k, id: map[String(k.id)] ?? String(k.id) }));
      return { title: o.title, questions, answer_key };
    } catch (e) { last = e; if (String((e as any)?.message) === "no_key") throw e; }
  }
  throw last;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "non_connecte" }, 401);
    if (!(await isValidated(user.id))) return json({ error: "non_valide" }, 403);
    if (!(await hasPremium(user.id))) return json({ error: "premium_required" }, 402);
    const b = await req.json();
    const db = admin();
    const nb = String(b.notebook_id || "");
    if (!nb) return json({ error: "cahier_manquant" }, 400);
    const content = clip(b.content);
    if (content.trim().length < 50) return json({ error: "cahier_vide" }, 400);

    if (b.action === "revision") {
      const mode = b.mode === "approfondie" ? "approfondie" : "general";
      const text = await mistral(REV[mode], `CONTENU DU CAHIER :\n${content}`, { max: 7000 });
      const { data, error } = await db.from("cn_revisions")
        .insert({ user_id: user.id, notebook_id: nb, mode, content: text }).select("id,created_at").single();
      if (error) throw error;
      return json({ id: data.id, created_at: data.created_at, mode, content: text });
    }

    if (b.action === "exam") {
      const blanc = b.mode === "blanc";
      const want = blanc
        ? "EXAMEN BLANC de 2 heures : 16 à 20 questions dont au moins 1 dissertation et 2 cas pratiques."
        : "EXAMEN SIMULÉ d'environ 1 heure : 10 à 14 questions.";
      const parts = blanc
        ? await Promise.all([
          genPart("PARTIE A d'un EXAMEN BLANC de 2 heures : exactement 10 questions courtes (4 QCM, 3 vrai_faux, 3 definition), 1 point chacune. Réponses modèles et explications concises.", content, "a", 6000),
          genPart("PARTIE B d'un EXAMEN BLANC de 2 heures : exactement 7 questions longues (1 dissertation de 6 points, 2 cas_pratique de 4 points, 2 raisonnement de 3 points, 2 ouverte de 3 points). Réponses modèles concises (10 lignes maximum ; dissertation : plan détaillé).", content, "b", 7000),
        ])
        : [await genPart(want, content, "q", 8000)];
      const out = {
        title: parts[0].title || parts[1]?.title || "Examen",
        questions: parts.flatMap((p: any) => p.questions),
        answer_key: parts.flatMap((p: any) => p.answer_key),
      };
      const qs: any[] = (out.questions || []).map((q: any, i: number) => ({
        id: String(q.id || "q" + (i + 1)), type: String(q.type || "ouverte"), points: Math.max(0.5, Number(q.points) || 1),
        text: String(q.text || ""), ...(Array.isArray(q.choices) ? { choices: q.choices.map(String).slice(0, 6) } : {}),
      })).filter((q: any) => q.text);
      if (qs.length < 3) throw new Error("examen_invalide");
      const sum = qs.reduce((s: number, q: any) => s + q.points, 0);
      qs.forEach((q: any) => (q.points = Math.round((q.points * 20 / sum) * 100) / 100));
      // Normalise le corrigé des questions fermées (index pour QCM, booléen pour vrai/faux) pour une correction fiable.
      const keyList: any[] = (out.answer_key || []).map((k: any) => {
        const q = qs.find((z: any) => z.id === String(k.id));
        if (q?.type === "qcm") {
          const a = k.answer, n = typeof a === "number" ? a : /^[A-Fa-f]$/.test(String(a).trim()) ? String(a).trim().toUpperCase().charCodeAt(0) - 65 : parseInt(String(a), 10);
          return { ...k, id: String(k.id), answer: Number.isFinite(n) ? n : 0 };
        }
        if (q?.type === "vrai_faux") return { ...k, id: String(k.id), answer: /^(true|vrai|oui|1)$/i.test(String(k.answer).trim()) };
        return { ...k, id: String(k.id) };
      });
      const { data: ex, error } = await db.from("cn_exams").insert({
        user_id: user.id, notebook_id: nb, title: String(out.title || "Examen"), mode: blanc ? "blanc" : "simulation",
        duration_minutes: blanc ? 120 : null, questions: qs,
      }).select("id,title,mode,duration_minutes,created_at").single();
      if (error) throw error;
      const { error: e2 } = await db.from("cn_exam_keys").insert({ exam_id: ex.id, answer_key: keyList });
      if (e2) { await db.from("cn_exams").delete().eq("id", ex.id); throw e2; }
      return json({ exam: ex, questions: qs });   // JAMAIS le corrigé
    }

    if (b.action === "grade") {
      const { data: ex } = await db.from("cn_exams").select("*").eq("id", b.exam_id).eq("user_id", user.id).single();
      if (!ex) return json({ error: "examen_introuvable" }, 404);
      // Une seule remise par examen : sinon on pourrait lire le corrigé puis repasser le même examen.
      const { data: done } = await db.from("cn_exam_attempts").select("id").eq("exam_id", ex.id).limit(1);
      if (done && done.length) return json({ error: "deja_corrige" }, 409);
      const { data: kr } = await db.from("cn_exam_keys").select("answer_key").eq("exam_id", ex.id).single();
      const key: any[] = kr?.answer_key || [];
      const answers: Record<string, unknown> = b.answers || {};
      const per: any[] = [], open: any[] = [];
      for (const q of ex.questions as any[]) {
        const k = key.find((x) => String(x.id) === q.id) || {};
        const given = answers[q.id];
        if (q.type === "qcm" || q.type === "vrai_faux") {
          const ok = given !== undefined && given !== null && given !== "" && String(given) === String(k.answer);
          per.push({ id: q.id, type: q.type, points: q.points, obtained: ok ? q.points : 0, correct: ok,
            correct_answer: k.answer, explanation: k.explanation || "", notion: k.notion || "" });
        } else {
          const row = { id: q.id, type: q.type, points: q.points, obtained: 0, correct_answer: k.answer, explanation: k.explanation || "", notion: k.notion || "", comment: "" };
          per.push(row);
          open.push({ id: q.id, type: q.type, points: q.points, question: q.text, answer_given: String(given ?? "").slice(0, 6000),
            model_answer: k.answer, criteria: k.criteria || [] });
        }
      }
      const { data: prev } = await db.from("cn_exam_attempts").select("score,report,submitted_at")
        .eq("user_id", user.id).eq("notebook_id", ex.notebook_id).order("submitted_at", { ascending: false }).limit(5);
      let extra: any = { errors: [], misunderstood_notions: [], recommendations: [], summary: "", comparison: "" };
      const sys = `${BASE}
Tu corriges des copies avec bienveillance mais sans complaisance. Réponds par UN objet JSON :
{"grades":[{"id":string,"obtained":number (0..points),"comment":string}],"errors":[string],"misunderstood_notions":[string],"recommendations":[string],"summary":string,"comparison":string}
"grades" ne couvre que les questions ouvertes fournies. "errors" : les erreurs précises de l'élève (toutes questions). "comparison" : évolution par rapport aux tentatives précédentes.`;
      const qcmErr = per.filter((p) => p.type !== undefined && (p.type === "qcm" || p.type === "vrai_faux") && !p.correct)
        .map((p) => ({ id: p.id, notion: p.notion, explanation: p.explanation }));
      const usr = `QUESTIONS OUVERTES À NOTER :\n${JSON.stringify(open)}\n\nQCM/VRAI-FAUX RATÉS :\n${JSON.stringify(qcmErr)}\n\nTENTATIVES PRÉCÉDENTES (récentes d'abord) :\n${JSON.stringify((prev || []).map((p: any) => ({ date: p.submitted_at, score: p.score, notions: p.report?.misunderstood_notions })))}`;
      if (open.length || qcmErr.length) extra = { ...extra, ...parseJson(await mistral(sys, usr, { json: true, max: 5000 })) };
      for (const g of extra.grades || []) {
        const row = per.find((p) => p.id === String(g.id));
        if (row && open.find((o) => o.id === row.id)) {
          row.obtained = Math.min(row.points, Math.max(0, Number(g.obtained) || 0));
          row.comment = String(g.comment || "");
        }
      }
      const total = per.reduce((s, p) => s + p.obtained, 0);
      const score = Math.round(Math.min(20, Math.max(0, total)) * 100) / 100;
      const report = {
        per_question: per, errors: extra.errors || [], misunderstood_notions: extra.misunderstood_notions || [],
        recommendations: extra.recommendations || [], summary: extra.summary || "", comparison: extra.comparison || "",
      };
      const { data: att, error } = await db.from("cn_exam_attempts").insert({
        exam_id: ex.id, user_id: user.id, notebook_id: ex.notebook_id, answers, score, report,
        duration_seconds: Number(b.duration_seconds) || null,
      }).select("id,submitted_at").single();
      if (error) throw error;
      return json({ attempt_id: att.id, score, report, history: (prev || []).map((p: any) => ({ score: p.score, submitted_at: p.submitted_at })) });
    }
    return json({ error: "action_inconnue" }, 400);
  } catch (e) {
    const m = String((e as any)?.message || e);
    return json({ error: m === "no_key" ? "no_key" : "erreur", detail: m.slice(0, 200) }, m === "no_key" ? 503 : 500);
  }
});

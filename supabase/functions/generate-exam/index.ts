import { assertPremium, askClaude, authenticate, collectNotebook, handle, HttpError, parseJson } from "../_shared/common.ts";

const TYPES = ["qcm", "ouverte", "dissertation", "vrai_faux", "definition", "cas_pratique", "raisonnement"];

Deno.serve(handle(async (req) => {
  const { notebookId, formats, mode = "simulation", count } = await req.json();
  const chosen: string[] = (formats ?? []).filter((f: string) => TYPES.includes(f));
  if (!notebookId || chosen.length === 0) throw new HttpError(400, "Choisis au moins un format");
  const blanc = mode === "blanc";
  const n = Math.min(Math.max(Number(count) || (blanc ? 20 : 12), 4), 40);
  const duration = blanc ? 120 : null;

  const { admin, user } = await authenticate(req);
  await assertPremium(admin, user.id);
  const { title, text } = await collectNotebook(admin, notebookId, user.id);

  const system = `Tu es un examinateur universitaire. Génère un examen ${blanc ? "BLANC de 2 heures, en conditions réelles" : "simulé"} de ${n} questions, ENTIÈREMENT FIDÈLE au cahier fourni (notes, audios transcrits, documents, schémas).
RÈGLES :
- Chaque question doit être résolvable UNIQUEMENT avec le contenu du cahier. Aucune connaissance extérieure.
- Formats autorisés (répartis équitablement) : ${chosen.join(", ")}.
- Le total des points = exactement 20. ${blanc ? "Les dissertations/cas pratiques pèsent plus lourd, comme dans un vrai examen." : ""}
- Formules en LaTeX entre $...$.
- Réponds UNIQUEMENT par un JSON valide :
{"title":"...","questions":[{"id":"q1","type":"qcm|ouverte|dissertation|vrai_faux|definition|cas_pratique|raisonnement","points":number,"statement":"...","choices":["..."] (qcm uniquement, 4 choix)}],
 "answer_key":[{"id":"q1","correct":(index du bon choix pour qcm | true/false pour vrai_faux | null sinon),"model_answer":"réponse modèle complète","criteria":["critère de notation 1","..."],"explanation":"explication pédagogique","source":"page/partie du cahier concernée"}]}`;

  const raw = await askClaude(system, text, 14000);
  const parsed = parseJson<{ title: string; questions: any[]; answer_key: any[] }>(raw);
  if (!parsed.questions?.length || !parsed.answer_key?.length) throw new HttpError(502, "Examen invalide, réessaie");

  const { data: exam, error } = await admin.from("exams").insert({
    user_id: user.id, notebook_id: notebookId, title: parsed.title || `Examen – ${title}`,
    mode, duration_minutes: duration, questions: parsed.questions,
  }).select("id,title,mode,duration_minutes,questions,created_at").single();
  if (error) throw new HttpError(500, error.message);

  await admin.from("exam_keys").insert({ exam_id: exam.id, answer_key: parsed.answer_key });
  return { exam };
}));

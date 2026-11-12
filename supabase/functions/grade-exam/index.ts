import { assertPremium, askClaude, authenticate, handle, HttpError, parseJson } from "../_shared/common.ts";

Deno.serve(handle(async (req) => {
  const { examId, answers, durationSeconds } = await req.json();
  if (!examId || typeof answers !== "object") throw new HttpError(400, "Paramètres invalides");
  const { admin, user } = await authenticate(req);
  await assertPremium(admin, user.id);

  const { data: exam } = await admin.from("exams").select("*").eq("id", examId).eq("user_id", user.id).maybeSingle();
  if (!exam) throw new HttpError(404, "Examen introuvable");
  const { data: key } = await admin.from("exam_keys").select("answer_key").eq("exam_id", examId).single();

  const system = `Tu es un correcteur universitaire rigoureux mais bienveillant. Corrige la copie ci-dessous à partir du corrigé et des critères fournis.
Une réponse vide vaut 0. Accorde des points partiels pour les réponses ouvertes selon les critères.
Réponds UNIQUEMENT par un JSON valide :
{"per_question":[{"id":"q1","awarded":number,"max":number,"verdict":"correct|partiel|incorrect|vide","feedback":"correction détaillée et explication"}],
 "errors":["erreur précise commise"],
 "misunderstood":["notion mal comprise (nom court)"],
 "recommendations":["conseil concret pour progresser"]}`;
  const payload = JSON.stringify({ questions: exam.questions, corrige: key!.answer_key, copie: answers });
  const g = parseJson<any>(await askClaude(system, payload, 10000));

  const per = (g.per_question ?? []).map((q: any) => {
    const max = Number(exam.questions.find((x: any) => x.id === q.id)?.points ?? q.max ?? 0);
    return { ...q, max, awarded: Math.min(Math.max(Number(q.awarded) || 0, 0), max) };
  });
  const totalMax = per.reduce((s: number, q: any) => s + q.max, 0) || 20;
  const score = Math.round((per.reduce((s: number, q: any) => s + q.awarded, 0) / totalMax) * 20 * 100) / 100;
  const overtime = exam.duration_minutes && durationSeconds > exam.duration_minutes * 60 + 120;

  // Comparaison avec les tentatives précédentes de ce cahier
  const { data: prev } = await admin.from("exam_attempts")
    .select("score,submitted_at,report").eq("notebook_id", exam.notebook_id).eq("user_id", user.id)
    .order("submitted_at", { ascending: false }).limit(10);
  const prevScores = (prev ?? []).map((a) => ({ score: Number(a.score), date: a.submitted_at })).reverse();
  const avg = prevScores.length ? prevScores.reduce((s, a) => s + a.score, 0) / prevScores.length : null;
  const past = new Set((prev ?? []).flatMap((a: any) => a.report?.misunderstood ?? []).map((s: string) => s.toLowerCase()));
  const comparison = {
    previous: prevScores,
    average: avg === null ? null : Math.round(avg * 100) / 100,
    delta_vs_last: prevScores.length ? Math.round((score - prevScores[prevScores.length - 1].score) * 100) / 100 : null,
    recurring_misunderstood: (g.misunderstood ?? []).filter((m: string) => past.has(m.toLowerCase())),
  };

  const report = { per_question: per, errors: g.errors ?? [], misunderstood: g.misunderstood ?? [],
    recommendations: g.recommendations ?? [], comparison, overtime: !!overtime };
  await admin.from("exam_attempts").insert({
    exam_id: examId, user_id: user.id, notebook_id: exam.notebook_id,
    answers, score, report, duration_seconds: durationSeconds ?? null,
  });
  return { score, report, modelAnswers: key!.answer_key };
}));

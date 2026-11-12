import { useEffect, useMemo, useRef, useState } from "react";
import { Exam, generateExam, gradeExam, QType, Question, Report } from "../../lib/studyApi";
import { PremiumGate } from "../premium/PremiumGate";
import { RichText } from "./RichText";
import "../../styles/study.css";

const FORMATS: { id: QType; label: string }[] = [
  { id: "qcm", label: "Choix multiples" }, { id: "vrai_faux", label: "Vrai ou faux" },
  { id: "definition", label: "Définitions" }, { id: "ouverte", label: "Questions ouvertes" },
  { id: "dissertation", label: "Dissertation" }, { id: "cas_pratique", label: "Cas pratiques" },
  { id: "raisonnement", label: "Raisonnement" },
];
type Answers = Record<string, unknown>;
type Phase = "config" | "loading" | "running" | "grading" | "result";

export function ExamPage({ notebookId }: { notebookId: string }) {
  return <PremiumGate><Inner notebookId={notebookId} /></PremiumGate>;
}

function Inner({ notebookId }: { notebookId: string }) {
  const [phase, setPhase] = useState<Phase>("config");
  const [formats, setFormats] = useState<QType[]>(["qcm", "vrai_faux", "ouverte"]);
  const [blanc, setBlanc] = useState(false);
  const [count, setCount] = useState(12);
  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<{ score: number; report: Report } | null>(null);
  const [err, setErr] = useState("");
  const startedAt = useRef(0);
  const [left, setLeft] = useState<number | null>(null);

  const draftKey = exam ? `exam-draft:${exam.id}` : "";

  async function start() {
    setPhase("loading"); setErr("");
    try {
      const e = await generateExam({ notebookId, formats, mode: blanc ? "blanc" : "simulation", count: blanc ? undefined : count });
      setExam(e); setAnswers({}); startedAt.current = Date.now();
      setLeft(e.duration_minutes ? e.duration_minutes * 60 : null);
      setPhase("running");
    } catch (e) { setErr((e as Error).message); setPhase("config"); }
  }

  async function submit() {
    if (!exam || phase !== "running") return;
    setPhase("grading");
    try {
      const r = await gradeExam(exam.id, answers, Math.round((Date.now() - startedAt.current) / 1000));
      localStorage.removeItem(draftKey); setResult(r); setPhase("result");
    } catch (e) { setErr((e as Error).message); setPhase("running"); }
  }

  // Chronomètre basé sur l'horloge (fiable même si l'onglet est en arrière-plan)
  useEffect(() => {
    if (phase !== "running" || !exam?.duration_minutes) return;
    const t = setInterval(() => {
      const remaining = exam.duration_minutes! * 60 - Math.floor((Date.now() - startedAt.current) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) { clearInterval(t); submit(); }
    }, 1000);
    return () => clearInterval(t);
  }, [phase, exam]);

  useEffect(() => { if (phase === "running" && draftKey) localStorage.setItem(draftKey, JSON.stringify(answers)); }, [answers]);

  // Examen blanc : avertir avant de quitter la page
  useEffect(() => {
    if (phase !== "running" || !exam?.duration_minutes) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h);
  }, [phase, exam]);

  if (phase === "config" || phase === "loading") return (
    <div className="st-wrap">
      <h2>Simulation d'examen</h2>
      <p className="st-muted">Générée à partir de tout ton cahier : notes, audios transcrits, documents et schémas.</p>
      <fieldset className="st-fieldset"><legend>Formats</legend>
        {FORMATS.map((f) => (
          <label key={f.id} className="st-check">
            <input type="checkbox" checked={formats.includes(f.id)}
              onChange={(e) => setFormats((p) => e.target.checked ? [...p, f.id] : p.filter((x) => x !== f.id))} />
            {f.label}
          </label>))}
      </fieldset>
      <label className="st-check"><input type="checkbox" checked={blanc} onChange={(e) => setBlanc(e.target.checked)} />
        Examen blanc de 2 h (chronomètre, correction à la fin)</label>
      {!blanc && <label className="st-muted">Nombre de questions : {count}
        <input type="range" min={4} max={30} value={count} onChange={(e) => setCount(+e.target.value)} /></label>}
      {err && <p className="st-error" role="alert">{err}</p>}
      <button className="st-btn" disabled={phase === "loading" || !formats.length} onClick={start}>
        {phase === "loading" ? "Création de l'examen…" : "Lancer l'examen"}
      </button>
    </div>
  );

  if (!exam) return null;

  if (phase === "result" && result) return <Result exam={exam} {...result} onRestart={() => setPhase("config")} />;

  const mm = left !== null ? String(Math.floor(left / 60)).padStart(2, "0") : "";
  const ss = left !== null ? String(left % 60).padStart(2, "0") : "";
  return (
    <div className="st-wrap">
      <header className="st-examhead">
        <h2>{exam.title}</h2>
        {left !== null && <div className={"st-timer" + (left < 600 ? " warn" : "")} role="timer" aria-live="off">{mm}:{ss}</div>}
      </header>
      {exam.questions.map((q, i) => (
        <QuestionBlock key={q.id} q={q} n={i + 1} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
      ))}
      {err && <p className="st-error" role="alert">{err}</p>}
      <button className="st-btn" disabled={phase === "grading"} onClick={() => confirm("Rendre ta copie ?") && submit()}>
        {phase === "grading" ? "Correction en cours…" : "Rendre la copie"}
      </button>
    </div>
  );
}

function QuestionBlock({ q, n, value, onChange }: { q: Question; n: number; value: unknown; onChange: (v: unknown) => void }) {
  const long = ["dissertation", "cas_pratique"].includes(q.type);
  return (
    <section className="st-q">
      <h3>Question {n} <span className="st-muted">({q.points} pt{q.points > 1 ? "s" : ""})</span></h3>
      <RichText>{q.statement}</RichText>
      {q.type === "qcm" && q.choices?.map((c, i) => (
        <label key={i} className="st-check"><input type="radio" name={q.id} checked={value === i} onChange={() => onChange(i)} /><RichText>{c}</RichText></label>))}
      {q.type === "vrai_faux" && [true, false].map((b) => (
        <label key={String(b)} className="st-check"><input type="radio" name={q.id} checked={value === b} onChange={() => onChange(b)} />{b ? "Vrai" : "Faux"}</label>))}
      {!["qcm", "vrai_faux"].includes(q.type) &&
        <textarea rows={long ? 12 : 5} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="Ta réponse…" />}
    </section>
  );
}

function Result({ exam, score, report, onRestart }: { exam: Exam; score: number; report: Report; onRestart: () => void }) {
  const byId = useMemo(() => Object.fromEntries(report.per_question.map((q) => [q.id, q])), [report]);
  const c = report.comparison;
  const hist = [...c.previous.map((p) => p.score), score];
  return (
    <div className="st-wrap">
      <div className="st-score"><strong>{score.toFixed(1)}</strong><span>/ 20</span></div>
      {report.overtime && <p className="st-error">Temps dépassé : dans un vrai examen, ta copie aurait été ramassée avant.</p>}

      <h3>Comparaison avec tes simulations précédentes</h3>
      {c.previous.length === 0 ? <p className="st-muted">Première simulation de ce cahier : elle sert de point de départ.</p> : (<>
        <p>{c.delta_vs_last! >= 0 ? "+" : ""}{c.delta_vs_last} pt vs la dernière · moyenne précédente {c.average}/20</p>
        <div className="st-bars" aria-label="Historique des notes">
          {hist.map((s, i) => <div key={i} className={i === hist.length - 1 ? "bar now" : "bar"} style={{ height: `${(s / 20) * 100}%` }}><span>{s.toFixed(1)}</span></div>)}
        </div>
        {c.recurring_misunderstood.length > 0 && <p>Notions encore fragiles : {c.recurring_misunderstood.join(", ")}.</p>}
      </>)}

      <h3>Erreurs commises</h3><ul>{report.errors.map((e, i) => <li key={i}><RichText>{e}</RichText></li>)}</ul>
      <h3>Notions mal comprises</h3><ul>{report.misunderstood.map((e, i) => <li key={i}>{e}</li>)}</ul>
      <h3>Pour progresser</h3><ul>{report.recommendations.map((e, i) => <li key={i}><RichText>{e}</RichText></li>)}</ul>

      <h3>Correction détaillée</h3>
      {exam.questions.map((q, i) => { const r = byId[q.id]; return (
        <details key={q.id} className="st-q" open={r?.verdict !== "correct"}>
          <summary>Question {i + 1} — {r?.awarded ?? 0}/{r?.max ?? q.points} · {r?.verdict}</summary>
          <RichText>{q.statement}</RichText>
          <RichText>{r?.feedback ?? ""}</RichText>
        </details>); })}
      <button className="st-btn" onClick={onRestart}>Nouvelle simulation</button>
    </div>
  );
}

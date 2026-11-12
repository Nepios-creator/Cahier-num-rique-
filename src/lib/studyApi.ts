// ⚠️ Adapte cet import à ton client Supabase existant.
import { supabase } from "./supabase";

export type QType = "qcm" | "ouverte" | "dissertation" | "vrai_faux" | "definition" | "cas_pratique" | "raisonnement";
export interface Question { id: string; type: QType; points: number; statement: string; choices?: string[] }
export interface Exam { id: string; title: string; mode: "simulation" | "blanc"; duration_minutes: number | null; questions: Question[] }
export interface QResult { id: string; awarded: number; max: number; verdict: string; feedback: string }
export interface Report {
  per_question: QResult[]; errors: string[]; misunderstood: string[]; recommendations: string[]; overtime: boolean;
  comparison: { previous: { score: number; date: string }[]; average: number | null; delta_vs_last: number | null; recurring_misunderstood: string[] };
}
export interface Revision { id: string; mode: "general" | "approfondie"; content: string; created_at: string }

export class ApiError extends Error { constructor(m: string, public status?: number) { super(m); } }

async function call<T>(fn: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let msg = error.message, status: number | undefined;
    try { const ctx = (error as any).context; status = ctx.status; msg = (await ctx.json()).error ?? msg; } catch { /* ignore */ }
    throw new ApiError(msg, status);
  }
  return data as T;
}

export const generateRevision = (notebookId: string, mode: "general" | "approfondie") =>
  call<{ revision: Revision }>("generate-revision", { notebookId, mode }).then((r) => r.revision);

export const getLatestRevision = async (notebookId: string, mode: string) => {
  const { data } = await supabase.from("revisions").select("id,mode,content,created_at")
    .eq("notebook_id", notebookId).eq("mode", mode).order("created_at", { ascending: false }).limit(1);
  return (data?.[0] as Revision) ?? null;
};

export const generateExam = (p: { notebookId: string; formats: QType[]; mode: "simulation" | "blanc"; count?: number }) =>
  call<{ exam: Exam }>("generate-exam", p).then((r) => r.exam);

export const gradeExam = (examId: string, answers: Record<string, unknown>, durationSeconds: number) =>
  call<{ score: number; report: Report; modelAnswers: any[] }>("grade-exam", { examId, answers, durationSeconds });

export const startCheckout = async () => {
  const { url } = await call<{ url: string }>("create-checkout", {
    successUrl: window.location.href, cancelUrl: window.location.href });
  window.location.href = url;
};

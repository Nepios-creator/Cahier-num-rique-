import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
export const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

export class HttpError extends Error {
  constructor(public status: number, m: string) { super(m); }
}

export function handle(fn: (req: Request) => Promise<unknown>) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    try { return json(await fn(req)); }
    catch (e) {
      console.error(e);
      return json({ error: (e as Error).message }, e instanceof HttpError ? e.status : 500);
    }
  };
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

export async function authenticate(req: Request) {
  const admin = adminClient();
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Non connecté");
  return { admin, user: data.user };
}

export async function assertPremium(admin: SupabaseClient, userId: string) {
  const { data } = await admin.rpc("has_premium_access", { uid: userId });
  if (!data) throw new HttpError(402, "Abonnement premium requis");
}

/**
 * ADAPTATEUR : récupère TOUT le contenu d'un cahier.
 * ⚠️ Adapte les noms de tables/colonnes à ton schéma si besoin.
 * Supposé : notebooks(id,user_id,title) · pages(id,notebook_id,title,content,position)
 *           transcripts(notebook_id,page_id,text) · documents(notebook_id,name,extracted_text)
 *           drawings(notebook_id,page_id,caption)
 */
export async function collectNotebook(admin: SupabaseClient, notebookId: string, userId: string) {
  const { data: nb } = await admin.from("notebooks").select("id,title,user_id").eq("id", notebookId).maybeSingle();
  if (!nb || nb.user_id !== userId) throw new HttpError(404, "Cahier introuvable");

  const safe = async (p: PromiseLike<{ data: any[] | null; error: unknown }>) => {
    const { data, error } = await p;
    if (error) console.warn("collectNotebook:", error);
    return data ?? [];
  };
  const [pages, transcripts, docs, drawings] = await Promise.all([
    safe(admin.from("pages").select("id,title,content,position").eq("notebook_id", notebookId).order("position")),
    safe(admin.from("transcripts").select("page_id,text").eq("notebook_id", notebookId)),
    safe(admin.from("documents").select("name,extracted_text").eq("notebook_id", notebookId)),
    safe(admin.from("drawings").select("page_id,caption").eq("notebook_id", notebookId)),
  ]);

  const parts: string[] = [`# CAHIER : ${nb.title}`];
  pages.forEach((p: any, i: number) => {
    parts.push(`\n## PAGE ${i + 1} — ${p.title ?? "Sans titre"}\n${p.content ?? ""}`);
    transcripts.filter((t: any) => t.page_id === p.id).forEach((t: any) => parts.push(`[AUDIO TRANSCRIT]\n${t.text}`));
    drawings.filter((d: any) => d.page_id === p.id && d.caption).forEach((d: any) => parts.push(`[SCHÉMA/DESSIN] ${d.caption}`));
  });
  transcripts.filter((t: any) => !pages.some((p: any) => p.id === t.page_id))
    .forEach((t: any) => parts.push(`\n[AUDIO TRANSCRIT]\n${t.text}`));
  docs.forEach((d: any) => parts.push(`\n## DOCUMENT TÉLÉVERSÉ — ${d.name}\n${d.extracted_text ?? ""}`));

  const text = parts.join("\n").slice(0, 300_000);
  if (text.length < 200) throw new HttpError(422, "Le cahier est trop vide pour générer du contenu");
  return { title: nb.title as string, text };
}

export async function askClaude(system: string, user: string, maxTokens = 8000): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("CLAUDE_MODEL") ?? "claude-sonnet-5-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!r.ok) throw new HttpError(502, "Erreur IA : " + (await r.text()));
  const d = await r.json();
  return d.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
}

export function parseJson<T = any>(t: string): T {
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) throw new HttpError(502, "Réponse IA invalide");
  try { return JSON.parse(m[0]); } catch { throw new HttpError(502, "JSON IA invalide, réessaie"); }
}
